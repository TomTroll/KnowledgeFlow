// packages/obsidian-plugin/src/gemini-models.ts
// Canonical Gemini model identifiers — change here to update everywhere.
//
// Both gemini-api.ts (batch embeddings) and settings-tab.ts (key validation)
// import from this file, so a single update propagates automatically.

export const EMBEDDING_MODEL = 'gemini-embedding-2';
export const FLASH_MODEL = 'gemini-2.0-flash';
