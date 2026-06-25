// packages/obsidian-plugin/src/tests/vector-store.test.ts
// Tests for the VectorStore — cosine similarity search and cache management.
// All pure in-memory operations; no Obsidian or Gemini APIs involved.

import { describe, it, expect, beforeEach } from 'vitest';
import { VectorStore } from '../vector-store';
import type { VectorCacheEntry } from '@knowledgeflow/shared';

// Helper: create a unit vector in a given "direction"
function makeEntry(
  vaultPath: string,
  direction: number[], // raw vector, will be stored as-is
  updatedAt = 1000,
): VectorCacheEntry {
  return { vaultPath, title: vaultPath, embedding: direction, updatedAt };
}

// Normalise a vector so cosine similarity gives predictable results
function normalize(v: number[]): number[] {
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / mag);
}

describe('VectorStore', () => {
  let store: VectorStore;

  beforeEach(() => {
    store = new VectorStore();
  });

  // -------------------------------------------------------------------------
  // Basic CRUD
  // -------------------------------------------------------------------------

  it('starts empty', () => {
    expect(store.size).toBe(0);
    expect(store.getAll()).toHaveLength(0);
  });

  it('upserts an entry and reflects it in size', () => {
    store.upsert(makeEntry('a.md', [1, 0]));
    expect(store.size).toBe(1);
  });

  it('upserting the same vaultPath replaces the existing entry', () => {
    store.upsert(makeEntry('a.md', [1, 0], 1000));
    store.upsert(makeEntry('a.md', [0, 1], 2000));
    expect(store.size).toBe(1);
    expect(store.getAll()[0].updatedAt).toBe(2000);
  });

  it('deletes an entry by vaultPath', () => {
    store.upsert(makeEntry('a.md', [1, 0]));
    store.delete('a.md');
    expect(store.size).toBe(0);
  });

  it('delete on a non-existent path is a no-op', () => {
    store.upsert(makeEntry('a.md', [1, 0]));
    store.delete('does-not-exist.md');
    expect(store.size).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Cosine similarity search
  // -------------------------------------------------------------------------

  it('findTopK returns the top-k entries sorted by descending cosine similarity', () => {
    // Three entries: A points in [1,0], B in [0,1], C at 45°
    store.upsert(makeEntry('a.md', normalize([1, 0])));
    store.upsert(makeEntry('b.md', normalize([0, 1])));
    store.upsert(makeEntry('c.md', normalize([1, 1])));

    // Query close to [1,0] → A should rank first
    const results = store.findTopK(normalize([1, 0.01]), 3);
    expect(results[0].vaultPath).toBe('a.md');
    expect(results).toHaveLength(3);
  });

  it('findTopK returns ≤k results when the store has fewer entries', () => {
    store.upsert(makeEntry('a.md', normalize([1, 0])));
    const results = store.findTopK(normalize([1, 0]), 5);
    expect(results).toHaveLength(1);
  });

  it('findTopK returns results in descending similarity order', () => {
    store.upsert(makeEntry('exact.md', normalize([1, 0])));
    store.upsert(makeEntry('orthogonal.md', normalize([0, 1])));
    const results = store.findTopK(normalize([1, 0]), 2);
    expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
    expect(results[0].vaultPath).toBe('exact.md');
  });

  it('cosine similarity of identical vectors is 1.0', () => {
    const vec = normalize([3, 4]);
    store.upsert(makeEntry('same.md', vec));
    const results = store.findTopK(vec, 1);
    expect(results[0].similarity).toBeCloseTo(1.0, 6);
  });

  it('cosine similarity of orthogonal vectors is 0', () => {
    store.upsert(makeEntry('ortho.md', normalize([1, 0])));
    const results = store.findTopK(normalize([0, 1]), 1);
    expect(results[0].similarity).toBeCloseTo(0, 6);
  });

  // -------------------------------------------------------------------------
  // Serialization support
  // -------------------------------------------------------------------------

  it('loadAll replaces all entries', () => {
    store.upsert(makeEntry('old.md', [1, 0]));
    store.loadAll([makeEntry('new1.md', [1, 0]), makeEntry('new2.md', [0, 1])]);
    expect(store.size).toBe(2);
    expect(store.getAll().map((e) => e.vaultPath)).toContain('new1.md');
    expect(store.getAll().map((e) => e.vaultPath)).not.toContain('old.md');
  });
});
