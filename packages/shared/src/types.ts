// =============================================================================
// KnowledgeFlow — Shared Type Contracts
// packages/shared/src/types.ts
//
// Single source of truth for all payload shapes exchanged between the
// Chrome Extension and the Obsidian Plugin via the localhost HTTP bridge.
// Both packages import from '@knowledgeflow/shared'.
// =============================================================================

// ---------------------------------------------------------------------------
// Vector Store
// ---------------------------------------------------------------------------

/** One entry in the in-memory vector cache, persisted to vector-cache.json. */
export interface VectorCacheEntry {
  /** Vault-relative path, e.g. "Inbox/My Note.md" */
  vaultPath: string;
  /** Note title (basename without extension) */
  title: string;
  /** 768-dimensional embedding from gemini-embedding-2 (outputDimensionality: 768, MRL) */
  embedding: number[];
  /** mtime Unix ms — used for differential sync */
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Clip Log
// ---------------------------------------------------------------------------

/** Lifecycle status of a clip after insertion. */
export type ClipStatus = 'inserted' | 'undone' | 'relocated' | 'queued';

/**
 * Persisted log entry for every clip that has been processed.
 * Returned as an array by GET /clips; the id is embedded in the
 * callout block as [clip-id:: <id>] for the Undo mechanism.
 */
export interface ClipLogEntry {
  /** crypto.randomUUID() — also embedded in the callout block */
  id: string;
  sourceUrl: string;
  pageTitle: string;
  selectedText: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Vault-relative path of the note where the clip was inserted */
  matchedPath: string;
  /** null when LLM validation is disabled */
  justification: string | null;
  tags: string[];
  comment: string;
  status: ClipStatus;
}

// ---------------------------------------------------------------------------
// Plugin Settings
// ---------------------------------------------------------------------------

/** Persisted via Obsidian's this.loadData() / this.saveData(). */
export interface PluginSettings {
  geminiKey: string;
  /** SHA-256 hash of the raw Bearer token; raw token shown once in UI */
  authTokenHash: string;
  /** The raw Bearer token, stored to make it permanently visible in the UI */
  rawAuthToken: string;
  /** HTTP server port, default 37321 */
  port: number;
  /** Cosine similarity threshold below which a new note is created, default 0.70 */
  threshold: number;
  llmValidationEnabled: boolean;
  autoSyncEnabled: boolean;
}

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  geminiKey: '',
  authTokenHash: '',
  rawAuthToken: '',
  port: 37321,
  threshold: 0.70,
  llmValidationEnabled: true,
  autoSyncEnabled: true,
};

// ---------------------------------------------------------------------------
// HTTP Payloads — POST /clip
// ---------------------------------------------------------------------------

/** Body sent by the Chrome Extension to POST /clip. */
export interface ClipRequest {
  selectedText: string;
  sourceUrl: string;
  pageTitle: string;
  tags: string[];
  comment: string;
}

/** 200 OK response from POST /clip (synchronous insertion). */
export interface ClipResponse {
  success: true;
  clipId: string;
  matchedPath: string;
  /** null when LLM validation is disabled */
  justification: string | null;
  /** Populated only when a new note was auto-created (below threshold) */
  suggestedTitle?: string;
}

/**
 * 202 Accepted response from POST /clip when the Gemini rate limit is hit.
 * The extension should poll GET /clips until the clip's status changes.
 */
export interface ClipQueuedResponse {
  success: false;
  queued: true;
  clipId: string;
  /** Unix ms timestamp when the plugin will retry */
  retryAfter: number;
}

// ---------------------------------------------------------------------------
// HTTP Payloads — GET /status
// ---------------------------------------------------------------------------

/** Response from GET /status — used by the extension "Test Connection" button. */
export interface StatusResponse {
  pluginVersion: string;
  /** Whether a batch embedding job is currently running */
  isIndexing: boolean;
  cachedNoteCount: number;
  /** Estimated remaining Gemini API calls for today */
  dailyQuotaRemaining: number;
  /** ISO 8601 timestamp of the last completed index run */
  lastIndexedAt: string | null;
  /** Number of clips currently waiting in the retry queue due to rate limits */
  queuedClips: number;
}

// ---------------------------------------------------------------------------
// HTTP Payloads — GET /clips
// ---------------------------------------------------------------------------

/** Response from GET /clips — last 10 ClipLogEntry objects. */
export interface ClipsResponse {
  clips: ClipLogEntry[];
}
