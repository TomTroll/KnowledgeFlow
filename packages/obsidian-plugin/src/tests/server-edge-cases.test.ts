// packages/obsidian-plugin/src/tests/server-edge-cases.test.ts
// RED → GREEN tests for edge cases and bugs in server.ts
//
// These tests were written AFTER identifying bugs in the initial implementation.
// Each test represents one concrete failure mode.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { hashToken } from '../auth';
import { createServer, type ServerDeps } from '../server';

const RAW_TOKEN = 'edge-case-token-xyz';
let storedHash: string;

function makeStubDeps(overrides: Partial<ServerDeps> = {}): ServerDeps {
  return {
    getAuthHash: () => storedHash,
    getPluginVersion: () => '0.1.0',
    getIsIndexing: () => false,
    getCachedNoteCount: () => 0,
    getDailyQuotaRemaining: () => 1500,
    getLastIndexedAt: () => null,
    getQueuedClipsCount: () => 0,
    getRecentClips: () => [],
    handleClip: async () => ({
      success: true as const,
      clipId: 'clip-id',
      matchedPath: 'Notes/Test.md',
      justification: null,
    }),
    ...overrides,
  };
}

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  storedHash = await hashToken(RAW_TOKEN);
  server = createServer(makeStubDeps());
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const { port } = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

// ---------------------------------------------------------------------------
// Bug #1: POST /clip with malformed JSON must return 400, not 500
// ---------------------------------------------------------------------------
describe('POST /clip with malformed JSON body', () => {
  it('returns 400 Bad Request instead of crashing with 500', async () => {
    const res = await fetch(`${baseUrl}/clip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAW_TOKEN}`,
      },
      body: 'this is { not valid JSON',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// Bug #2: URL with query string should still match routes
// ---------------------------------------------------------------------------
describe('URL matching with query strings', () => {
  it('GET /status?v=1 still returns 200', async () => {
    const res = await fetch(`${baseUrl}/status?v=1`, {
      headers: { Authorization: `Bearer ${RAW_TOKEN}` },
    });
    expect(res.status).toBe(200);
  });

  it('GET /clips?limit=5 still returns 200', async () => {
    const res = await fetch(`${baseUrl}/clips?limit=5`, {
      headers: { Authorization: `Bearer ${RAW_TOKEN}` },
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Bug #3: POST /clip with empty body must return 400
// ---------------------------------------------------------------------------
describe('POST /clip with empty body', () => {
  it('returns 400 when body is empty', async () => {
    const res = await fetch(`${baseUrl}/clip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAW_TOKEN}`,
      },
      body: '',
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Bug #4: handleClip errors should return 500, not crash the server
// ---------------------------------------------------------------------------
describe('handleClip error propagation', () => {
  it('returns 500 when handleClip throws, without crashing the server', async () => {
    const brokenServer = createServer(
      makeStubDeps({
        handleClip: async () => {
          throw new Error('Gemini API exploded');
        },
      }),
    );
    await new Promise<void>((r) => brokenServer.listen(0, () => r()));
    const { port } = brokenServer.address() as { port: number };

    const res = await fetch(`http://127.0.0.1:${port}/clip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAW_TOKEN}`,
      },
      body: JSON.stringify({ selectedText: 'test', sourceUrl: 'https://x.com', pageTitle: 'X', tags: [], comment: '' }),
    });

    // Server should still be responsive after the error
    expect(res.status).toBe(500);

    // Server itself should still accept new requests
    const statusRes = await fetch(`http://127.0.0.1:${port}/status`, {
      headers: { Authorization: `Bearer ${RAW_TOKEN}` },
    });
    expect(statusRes.status).toBe(200);

    await new Promise<void>((r) => brokenServer.close(() => r()));
  });
});
