// packages/obsidian-plugin/src/tests/server.test.ts
// Integration tests for the KnowledgeFlow HTTP server.
//
// Strategy: spin up a real Node.js HTTP server on a random port, make real
// HTTP requests with `fetch`, assert on observable responses.
// The Gemini client and vault are injected as minimal stubs — we test the
// server's behavior, not Gemini's.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { hashToken } from '../auth';
import { createServer, type ServerDeps } from '../server';
import type { ClipLogEntry } from '@knowledgeflow/shared';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const RAW_TOKEN = 'test-bearer-token-12345';
let storedHash: string;

/** Minimal stub satisfying the ServerDeps interface. */
function makeStubDeps(overrides: Partial<ServerDeps> = {}): ServerDeps {
  return {
    getAuthHash: () => storedHash,
    getPluginVersion: () => '0.1.0',
    getIsIndexing: () => false,
    getCachedNoteCount: () => 42,
    getDailyQuotaRemaining: () => 1450,
    getLastIndexedAt: () => '2026-06-24T12:00:00Z',
    getQueuedClipsCount: () => 0,
    getRecentClips: () => [],
    handleClip: async () => ({
      success: true as const,
      clipId: 'test-clip-id',
      matchedPath: 'Notes/Test.md',
      justification: 'Stub justification',
    }),
    ...overrides,
  };
}

function authHeader(token = RAW_TOKEN) {
  return `Bearer ${token}`;
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  storedHash = await hashToken(RAW_TOKEN);
  server = createServer(makeStubDeps());
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

// ---------------------------------------------------------------------------
// GET /status
// ---------------------------------------------------------------------------

describe('GET /status', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await fetch(`${baseUrl}/status`);
    expect(res.status).toBe(401);
  });

  it('returns 401 when a tampered token is provided', async () => {
    const res = await fetch(`${baseUrl}/status`, {
      headers: { Authorization: 'Bearer wrong-token' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 with correct shape when a valid token is provided', async () => {
    const res = await fetch(`${baseUrl}/status`, {
      headers: { Authorization: authHeader() },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      pluginVersion: '0.1.0',
      isIndexing: false,
      cachedNoteCount: 42,
      dailyQuotaRemaining: 1450,
      lastIndexedAt: '2026-06-24T12:00:00Z',
    });
  });
});

// ---------------------------------------------------------------------------
// GET /clips
// ---------------------------------------------------------------------------

describe('GET /clips', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await fetch(`${baseUrl}/clips`);
    expect(res.status).toBe(401);
  });

  it('returns 200 with an empty clips array when the log is empty', async () => {
    const res = await fetch(`${baseUrl}/clips`, {
      headers: { Authorization: authHeader() },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('clips');
    expect(Array.isArray(body.clips)).toBe(true);
    expect(body.clips).toHaveLength(0);
  });

  it('returns the clips provided by getRecentClips', async () => {
    const sampleClip: ClipLogEntry = {
      id: 'clip-001',
      sourceUrl: 'https://example.com',
      pageTitle: 'Example',
      selectedText: 'Hello world',
      timestamp: '2026-06-24T12:00:00Z',
      matchedPath: 'Notes/Example.md',
      justification: null,
      tags: [],
      comment: '',
      status: 'inserted',
    };
    const customServer = createServer(
      makeStubDeps({ getRecentClips: () => [sampleClip] }),
    );
    await new Promise<void>((r) => customServer.listen(0, '127.0.0.1', r));
    const { port } = customServer.address() as { port: number };
    const res = await fetch(`http://127.0.0.1:${port}/clips`, {
      headers: { Authorization: authHeader() },
    });
    const body = await res.json();
    expect(body.clips).toHaveLength(1);
    expect(body.clips[0].id).toBe('clip-001');
    await new Promise<void>((r) => customServer.close(() => r()));
  });
});

// ---------------------------------------------------------------------------
// POST /clip
// ---------------------------------------------------------------------------

describe('POST /clip', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await fetch(`${baseUrl}/clip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedText: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 with matchedPath and justification on a valid clip request', async () => {
    const res = await fetch(`${baseUrl}/clip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(),
      },
      body: JSON.stringify({
        selectedText: 'Some interesting passage',
        sourceUrl: 'https://example.com/article',
        pageTitle: 'Example Article',
        tags: ['research'],
        comment: '',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('matchedPath');
    expect(body).toHaveProperty('justification');
    expect(body.success).toBe(true);
  });
});
