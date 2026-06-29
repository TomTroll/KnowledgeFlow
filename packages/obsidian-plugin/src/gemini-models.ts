// packages/obsidian-plugin/src/gemini-models.ts
// Canonical Gemini model identifiers — change here to update everywhere.
//
// Both gemini-api.ts (batch embeddings) and settings-tab.ts (key validation)
// import from this file, so a single update propagates automatically.

/** Current embedding model. text-embedding-004 was retired 2026-01-14. */
export const EMBEDDING_MODEL = 'gemini-embedding-2';

/**
 * Output dimension for embeddings.
 * gemini-embedding-2 defaults to 3072 but supports flexible dims via MRL.
 * Pinned at 768 to match existing vector-cache.json files.
 */
export const EMBEDDING_DIMENSIONS = 768;

/**
 * Task type for document embeddings (vault notes).
 * RETRIEVAL_DOCUMENT optimises the vector for similarity search.
 */
export const EMBEDDING_TASK_TYPE = 'RETRIEVAL_DOCUMENT';

/**
 * Task type for query embeddings (incoming clip text to be matched).
 */
export const QUERY_TASK_TYPE = 'RETRIEVAL_QUERY';

export const FLASH_MODEL = 'gemini-2.0-flash';
