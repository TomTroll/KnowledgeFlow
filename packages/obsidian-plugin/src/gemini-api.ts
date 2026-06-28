// KnowledgeFlow – Gemini API Client
// Handles calls to gemini-1.5-flash for semantic context
// validation and intelligent clip routing.

import { EMBEDDING_MODEL } from './gemini-models';

export class GeminiRateLimitError extends Error {
  retryAfterMs: number;
  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'GeminiRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export async function getBatchEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`;
  
  const body = {
    requests: texts.map(text => ({
      model: `models/${EMBEDDING_MODEL}`,
      content: {
        parts: [{ text }]
      }
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
    const errText = await response.text();
    if (response.status === 429) {
      // Default to 60s if header is missing
      const retryAfterSec = parseInt(response.headers.get('Retry-After') || '60', 10);
      throw new GeminiRateLimitError(`Rate limit hit: ${errText}`, retryAfterSec * 1000);
    }
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  
  if (!data.embeddings || !Array.isArray(data.embeddings)) {
    throw new Error('Invalid response from Gemini API');
  }

  return data.embeddings.map((e: any) => e.values as number[]);
}
