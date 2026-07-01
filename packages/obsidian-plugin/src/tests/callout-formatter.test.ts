// packages/obsidian-plugin/src/tests/callout-formatter.test.ts
// TDD tests for the callout block formatter.
// Written BEFORE implementation (RED phase).

import { describe, it, expect } from 'vitest';
import { formatCallout } from '../callout-formatter';
import type { ClipRequest } from '@knowledgeflow/shared';

describe('formatCallout', () => {
  const baseRequest: ClipRequest = {
    selectedText: 'The quick brown fox jumps over the lazy dog.',
    sourceUrl: 'https://example.com/article',
    pageTitle: 'Example Article',
    tags: ['research', 'animals'],
    comment: 'Great example sentence',
  };
  const clipId = 'abc-123-uuid';

  it('contains all required fields in the Markdown callout', () => {
    const result = formatCallout(baseRequest, clipId);
    expect(result).toContain('> [!clip]');
    expect(result).toContain('> The quick brown fox jumps over the lazy dog.');
    expect(result).toContain('> **Source:**');
    expect(result).toContain('[Example Article](https://example.com/article)');
  });

  it('formats tags as #tag1 #tag2', () => {
    const result = formatCallout(baseRequest, clipId);
    expect(result).toContain('#research #animals');
  });

  it('starts each line with > for valid Obsidian callout syntax', () => {
    const result = formatCallout(baseRequest, clipId);
    const lines = result.split('\n');
    for (const line of lines) {
      expect(line.startsWith('>')).toBe(true);
    }
  });

  it('handles empty tags gracefully', () => {
    const req = { ...baseRequest, tags: [] };
    const result = formatCallout(req, clipId);
    // When tags are empty, there shouldn't be any tags appended
    expect(result).not.toContain('#');
  });

  it('includes a formatted timestamp in the header', () => {
    const result = formatCallout(baseRequest, clipId);
    // Should match a YYYY-MM-DD HH:MM format
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/);
  });
});
