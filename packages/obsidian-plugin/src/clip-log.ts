// packages/obsidian-plugin/src/clip-log.ts
// In-memory clip log with serialization support.
//
// Design:
//   - Backed by a simple array, most-recent-first insertion.
//   - loadAll / getAll for persistence via plugin.saveData().
//   - getRecent returns the last N entries (default 10).

import type { ClipLogEntry } from '@knowledgeflow/shared';

export class ClipLog {
  private entries: ClipLogEntry[] = [];

  /** Append a new entry (prepended to the front for most-recent-first). */
  append(entry: ClipLogEntry): void {
    this.entries.unshift(entry);
  }

  /** Return the most recent N entries (default 10). */
  getRecent(limit = 10): ClipLogEntry[] {
    return this.entries.slice(0, limit);
  }

  /** Return all entries (for serialization). */
  getAll(): ClipLogEntry[] {
    return [...this.entries];
  }

  /** Replace all entries (for deserialization on startup). */
  loadAll(entries: ClipLogEntry[]): void {
    this.entries = [...entries];
  }

  /** Update fields on an existing entry by id. Returns true if found. */
  updateEntry(id: string, patch: Partial<ClipLogEntry>): boolean {
    const entry = this.entries.find(e => e.id === id);
    if (!entry) return false;
    Object.assign(entry, patch);
    return true;
  }

  /** Number of entries in the log. */
  get size(): number {
    return this.entries.length;
  }
}
