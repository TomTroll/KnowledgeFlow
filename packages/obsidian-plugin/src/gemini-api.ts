// KnowledgeFlow – Gemini API Client
// Handles calls to gemini-1.5-flash for semantic context
// validation and intelligent clip routing.

export async function getBatchEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents?key=${apiKey}`;
  
  const body = {
    requests: texts.map(text => ({
      model: 'models/gemini-embedding-2',
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
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  
  if (!data.embeddings || !Array.isArray(data.embeddings)) {
    throw new Error('Invalid response from Gemini API');
  }

  return data.embeddings.map((e: any) => e.values as number[]);
}
