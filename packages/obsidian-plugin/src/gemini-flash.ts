// packages/obsidian-plugin/src/gemini-flash.ts
// LLM validation using Gemini 2.0 Flash.
//
// Sends the clip text + top-5 candidate notes to Flash with a strict JSON
// schema response. Returns the chosen path, justification, and optional
// suggested title for below-threshold new-note creation.

import { FLASH_MODEL } from './gemini-models';
import { GeminiRateLimitError, throwIfRateLimited } from './gemini-api';

export interface FlashCandidate {
  path: string;
  title: string;
  excerpt: string;
}

export interface FlashValidationResult {
  chosenPath: string;
  justification: string;
  suggestedTitle?: string;
}

/**
 * Validate clip routing using Gemini Flash.
 *
 * @param clipText    The user's selected text.
 * @param candidates  Top-5 candidate notes from cosine search.
 * @param apiKey      Gemini API key.
 * @param userComment Optional user comment to guide the routing.
 * @returns           The Flash model's routing decision.
 */
export async function validateWithFlash(
  clipText: string,
  candidates: FlashCandidate[],
  apiKey: string,
  userComment?: string,
): Promise<FlashValidationResult> {
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const candidateList = candidates
    .map((c, i) => `${i + 1}. "${c.title}" (${c.path})\n   Excerpt: ${c.excerpt}`)
    .join('\n');

  const commentSection = userComment
    ? `\n**User Comment / Intent (CRITICAL Priority):**\n${userComment}\n`
    : '';

  const prompt = `You are a knowledge routing assistant. A user has clipped the following text from the web and wants it inserted into the most relevant note in their Obsidian vault.
${commentSection}
**Clipped text:**
${clipText}

**Candidate notes (ranked by vector similarity):**
${candidateList}

Choose the best candidate note for this clip. If none of the candidates are a good match, set chosenPath to an empty string and provide a suggestedTitle for a new note.

Respond ONLY with valid JSON matching this schema:
{
  "chosenPath": "vault/path/to/note.md",
  "justification": "Brief explanation of why this note was chosen",
  "suggestedTitle": "Optional: suggested title if no good match"
}`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${FLASH_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            chosenPath: { type: 'string' },
            justification: { type: 'string' },
            suggestedTitle: { type: 'string' },
          },
          required: ['chosenPath', 'justification'],
        },
      },
    }),
  });

  if (!response.ok) {
    await throwIfRateLimited(response);
    const errText = await response.text();
    throw new Error(`Gemini Flash error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response from Gemini Flash');
  }

  const parsed = JSON.parse(text) as FlashValidationResult;

  // Guardrail: if chosenPath is not in the candidates set, fall back to top-1
  if (parsed.chosenPath && candidates.length > 0) {
    const validPaths = new Set(candidates.map(c => c.path));
    if (!validPaths.has(parsed.chosenPath)) {
      parsed.chosenPath = candidates[0].path;
    }
  }

  return parsed;
}
