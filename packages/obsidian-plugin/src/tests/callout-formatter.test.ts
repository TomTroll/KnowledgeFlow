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

  it('contains all required fields', () => {
    const result = formatCallout(baseRequest, clipId);
    expect(result).toContain('[!quote]');
    expect(result).toContain('The quick brown fox jumps over the lazy dog.');
    expect(result).toContain('**Source:**');
    expect(result).toContain('[Example Article](https://example.com/article)');
    expect(result).toContain('**Tags:**');
    expect(result).toContain('**Comment:**');
    expect(result).toContain('Great example sentence');
    expect(result).toContain('[clip-id:: abc-123-uuid]');
  });

  it('formats tags as #tag1 #tag2', () => {
    const result = formatCallout(baseRequest, clipId);
    expect(result).toContain('#research #animals');
  });

  it('uses the provided clip ID in the clip-id field', () => {
    const id = 'unique-uuid-456';
    const result = formatCallout(baseRequest, id);
    expect(result).toContain('[clip-id:: unique-uuid-456]');
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
    // Should still be valid, just no tags listed
    expect(result).toContain('**Tags:**');
  });

  it('handles empty comment gracefully', () => {
    const req = { ...baseRequest, comment: '' };
    const result = formatCallout(req, clipId);
    expect(result).toContain('**Comment:**');
  });

  it('includes an ISO timestamp in the header', () => {
    const result = formatCallout(baseRequest, clipId);
    // Should match ISO 8601 pattern in the header line
    expect(result).toMatch(/>\s*\[!quote\]\s*Clip\s*—\s*\d{4}-\d{2}-\d{2}T/);
  });
});
