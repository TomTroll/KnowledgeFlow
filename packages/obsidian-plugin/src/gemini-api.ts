// KnowledgeFlow – Gemini API Client
// Handles calls to the Gemini batch embedding API (via EMBEDDING_MODEL)
// and exports the shared GeminiRateLimitError for 429 handling.
//
// gemini-embedding-2 migration notes (text-embedding-004 was retired 2026-01-14):
//   - Model name: 'gemini-embedding-2'  (set via EMBEDDING_MODEL constant)
//   - outputDimensionality: 768 (pinned via Matryoshka; compatible with existing caches)
//   - taskType must be set per-request: RETRIEVAL_DOCUMENT for vault notes,
//     RETRIEVAL_QUERY for incoming clip text

import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, EMBEDDING_TASK_TYPE, QUERY_TASK_TYPE } from './gemini-models';

export class GeminiRateLimitError extends Error {
  retryAfterMs: number;
  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'GeminiRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Check a Gemini API response for 429 rate limiting and throw
 * GeminiRateLimitError if detected. Reusable across all Gemini endpoints.
 */
export async function throwIfRateLimited(response: Response): Promise<void> {
  if (response.status === 429) {
    const errText = await response.text();
    const retryAfterSec = parseInt(response.headers.get('Retry-After') || '60', 10);
    throw new GeminiRateLimitError(`Rate limit hit: ${errText}`, retryAfterSec * 1000);
  }
}

/**
 * Embed a batch of texts using gemini-embedding-2.
 *
 * @param texts    Strings to embed (max 100 per call — enforced by the caller).
 * @param apiKey   Gemini API key from plugin settings.
 * @param taskType 'RETRIEVAL_DOCUMENT' for vault notes (default),
 *                 'RETRIEVAL_QUERY' for incoming clip text.
 */
export async function getBatchEmbeddings(
  texts: string[],
  apiKey: string,
  taskType: string = EMBEDDING_TASK_TYPE,
): Promise<number[][]> {
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`;

  const body = {
    requests: texts.map(text => ({
      model: `models/${EMBEDDING_MODEL}`,
      content: {
        parts: [{ text }]
      },
      // Pin to 768 dims for backward-compat with existing vector-cache.json.
      // gemini-embedding-2 supports MRL: 768 / 1536 / 3072.
      outputDimensionality: EMBEDDING_DIMENSIONS,
      taskType,
    }))
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    await throwIfRateLimited(response);
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();

  if (!data.embeddings || !Array.isArray(data.embeddings)) {
    throw new Error('Invalid response from Gemini API');
  }

  return data.embeddings.map((e: { values: number[] }) => e.values);
}

/**
 * Embed a single clip text using RETRIEVAL_QUERY task type.
 * Use this for the incoming clip before cosine-searching the vault.
 */
export async function getQueryEmbedding(text: string, apiKey: string): Promise<number[]> {
  const [embedding] = await getBatchEmbeddings([text], apiKey, QUERY_TASK_TYPE);
  return embedding;
}
