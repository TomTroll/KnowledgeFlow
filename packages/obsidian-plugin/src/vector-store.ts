// packages/obsidian-plugin/src/vector-store.ts
// In-memory vector cache with cosine similarity search.
//
// Design:
//   - A flat Map of vaultPath → VectorCacheEntry (O(1) upsert/delete).
//   - findTopK performs a linear dot-product scan — sub-10 ms for ≤5,000 notes.
//   - No external dependencies; pure TypeScript.

import type { VectorCacheEntry } from '@knowledgeflow/shared';

export interface ScoredEntry extends VectorCacheEntry {
  similarity: number;
}

export class VectorStore {
  private cache = new Map<string, VectorCacheEntry>();

  /** Number of entries currently in the store. */
  get size(): number {
    return this.cache.size;
  }

  /** Insert or replace an entry by vaultPath. */
  upsert(entry: VectorCacheEntry): void {
    this.cache.set(entry.vaultPath, entry);
  }

  /** Remove an entry by vaultPath. No-op if not found. */
  delete(vaultPath: string): void {
    this.cache.delete(vaultPath);
  }

  /** Return all entries as an array (order not guaranteed). */
  getAll(): VectorCacheEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Replace all entries atomically (used when deserializing the cache file
   * on startup). Clears any existing in-memory state first.
   */
  loadAll(entries: VectorCacheEntry[]): void {
    this.cache.clear();
    for (const e of entries) {
      this.cache.set(e.vaultPath, e);
    }
  }

  /**
   * Linear cosine-similarity scan across all entries.
   * Returns the top-k entries sorted by descending similarity.
   *
   * Both `queryVector` and stored embeddings are assumed to be pre-normalised.
   * Cosine similarity reduces to a dot product for unit vectors.
   */
  findTopK(queryVector: number[], k: number): ScoredEntry[] {
    const scored: ScoredEntry[] = [];

    for (const entry of this.cache.values()) {
      const similarity = dotProduct(queryVector, entry.embedding);
      scored.push({ ...entry, similarity });
    }

    // Sort descending by similarity
    scored.sort((a, b) => b.similarity - a.similarity);

    return scored.slice(0, k);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Dot product of two equal-length vectors. */
function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}
