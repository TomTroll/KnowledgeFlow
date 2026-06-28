// packages/obsidian-plugin/src/server.ts
// Local HTTP server for the KnowledgeFlow Obsidian plugin.
//
// Design:
//   - createServer(deps) factory accepts all runtime dependencies via a
//     ServerDeps interface. This makes the server fully testable without
//     any Obsidian APIs in scope.
//   - The server listens on 127.0.0.1 only (never exposed externally).
//   - All endpoints require a valid Bearer token (SHA-256 validated).
//   - Routes are handled by a minimal manual router — no framework needed.

import http from 'http';
import { validateBearer } from './auth';
import type {
  ClipRequest,
  ClipResponse,
  ClipQueuedResponse,
  ClipLogEntry,
  StatusResponse,
} from '@knowledgeflow/shared';

// ---------------------------------------------------------------------------
// Dependency interface (injected by the Plugin class at runtime, stubbed in tests)
// ---------------------------------------------------------------------------

export interface ServerDeps {
  /** Returns the SHA-256 hash of the current auth token from settings. */
  getAuthHash(): string;
  /** Returns the plugin version string (from manifest.json). */
  getPluginVersion(): string;
  /** True while a batch embedding job is in progress. */
  getIsIndexing(): boolean;
  /** Number of VectorCacheEntry objects currently in memory. */
  getCachedNoteCount(): number;
  /** Estimated remaining Gemini API calls today. */
  getDailyQuotaRemaining(): number;
  /** ISO 8601 timestamp of the last completed index run, or null. */
  getLastIndexedAt(): string | null;
  /** Number of clips currently queued due to rate limiting. */
  getQueuedClipsCount(): number;
  /** Returns the last ≤10 ClipLogEntry objects, most-recent-first. */
  getRecentClips(): ClipLogEntry[];
  /** Runs the full clip routing pipeline and returns the result. */
  handleClip(req: ClipRequest): Promise<ClipResponse | ClipQueuedResponse>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

/**
 * Creates and returns a configured (but not yet listening) HTTP server.
 * Call `server.listen(port, '127.0.0.1', callback)` to start it.
 */
export function createServer(deps: ServerDeps): http.Server {
  return http.createServer(async (req, res) => {
    const authHeader = req.headers['authorization'] as string | undefined;

    // All routes require a valid Bearer token
    const isAuthed = await validateBearer(authHeader, deps.getAuthHash());
    if (!isAuthed) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }

    const method = req.method ?? 'GET';
    // Bug fix: strip query strings so /status?v=1 still matches '/status'.
    // Using URL constructor with a dummy base since req.url is path-only.
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;

    try {
      // ------------------------------------------------------------------
      // GET /status
      // ------------------------------------------------------------------
      if (method === 'GET' && pathname === '/status') {
        const body: StatusResponse = {
          pluginVersion: deps.getPluginVersion(),
          isIndexing: deps.getIsIndexing(),
          cachedNoteCount: deps.getCachedNoteCount(),
          dailyQuotaRemaining: deps.getDailyQuotaRemaining(),
          lastIndexedAt: deps.getLastIndexedAt(),
          queuedClips: deps.getQueuedClipsCount(),
        };
        return sendJson(res, 200, body);
      }

      // ------------------------------------------------------------------
      // GET /clips
      // ------------------------------------------------------------------
      if (method === 'GET' && pathname === '/clips') {
        return sendJson(res, 200, { clips: deps.getRecentClips() });
      }

      // ------------------------------------------------------------------
      // POST /clip
      // ------------------------------------------------------------------
      if (method === 'POST' && pathname === '/clip') {
        const raw = await readBody(req);

        // Bug fix: guard against empty or malformed JSON bodies → 400, not 500.
        if (!raw.trim()) {
          return sendJson(res, 400, { error: 'Request body is required' });
        }

        let clipRequest: ClipRequest;
        try {
          clipRequest = JSON.parse(raw) as ClipRequest;
        } catch {
          return sendJson(res, 400, { error: 'Invalid JSON body' });
        }

        const result = await deps.handleClip(clipRequest);
        const status = result.success ? 200 : 202;
        return sendJson(res, status, result);
      }

      // ------------------------------------------------------------------
      // 404 for anything else
      // ------------------------------------------------------------------
      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      sendJson(res, 500, { error: 'Internal Server Error' });
    }
  });
}
