export function extractAndRemoveCallout(
  content: string,
  clipId: string
): { newContent: string; extractedCallout: string } | null {
  const lines = content.split('\n');
  const targetTag = `[clip-id:: ${clipId}]`;

  // Find the end line
  let endIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(targetTag) && lines[i].startsWith('>')) {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return null;
  }

  // Scan backwards to find the start of the block
  let startIndex = endIndex;
  for (let i = endIndex; i >= 0; i--) {
    if (!lines[i].startsWith('>')) {
      // We stepped out of the quote block, so the block started at i + 1
      startIndex = i + 1;
      break;
    }
    if (lines[i].startsWith('> [!quote] Clip —')) {
      startIndex = i;
      break;
    }
    if (i === 0) {
      startIndex = 0;
    }
  }

  const extractedLines = lines.slice(startIndex, endIndex + 1);
  const extractedCallout = extractedLines.join('\n');

  // Remove the lines from the array
  lines.splice(startIndex, endIndex - startIndex + 1);
  const newContent = lines.join('\n');

  return {
    newContent,
    extractedCallout,
  };
}
