import { describe, it, expect } from 'vitest';
import { extractAndRemoveCallout } from '../actions/undo-action';

describe('extractAndRemoveCallout', () => {
  it('extracts callout and removes it from document', () => {
    const content = `Some prefix text.

> [!quote] Clip — 2026-06-28T12:00:00.000Z
> This is the clipped text.
> 
> **Source:** [Google](https://google.com)
> **Tags:** #search
> **Comment:** None
> [clip-id:: 12345]

Some postfix text.
`;
    
    const result = extractAndRemoveCallout(content, '12345');
    
    expect(result).not.toBeNull();
    expect(result!.extractedCallout).toContain('> [!quote] Clip');
    expect(result!.extractedCallout).toContain('[clip-id:: 12345]');
    
    // The new content should not have the callout, but preserve the prefix and postfix
    expect(result!.newContent).toBe(`Some prefix text.\n\n\nSome postfix text.\n`);
  });

  it('handles callout at the very beginning of the document', () => {
    const content = `> [!quote] Clip — 2026
> Text
> [clip-id:: abc]

Postfix`;
    const result = extractAndRemoveCallout(content, 'abc');
    expect(result!.extractedCallout).toBe(`> [!quote] Clip — 2026\n> Text\n> [clip-id:: abc]`);
    expect(result!.newContent).toBe(`\nPostfix`);
  });

  it('handles callout at the very end of the document', () => {
    const content = `Prefix
> [!quote] Clip
> [clip-id:: end]`;
    const result = extractAndRemoveCallout(content, 'end');
    expect(result!.newContent).toBe(`Prefix`);
  });

  it('returns null if clipId is not found', () => {
    const content = `> [!quote] Clip\n> [clip-id:: 999]`;
    const result = extractAndRemoveCallout(content, '111');
    expect(result).toBeNull();
  });
});
