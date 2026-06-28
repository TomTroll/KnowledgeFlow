// packages/obsidian-plugin/src/tests/markdown-parser.test.ts
// TDD tests for the markdown parsing utilities.
// Written BEFORE implementation (RED phase).

import { describe, it, expect, vi } from 'vitest';
import {
  stripFrontmatter,
  splitSections,
  splitParagraphs,
  insertCalloutAfterParagraph,
} from '../markdown-parser';

// ---------------------------------------------------------------------------
// stripFrontmatter
// ---------------------------------------------------------------------------

describe('stripFrontmatter', () => {
  it('removes YAML between --- delimiters', () => {
    const input = `---
title: My Note
tags: [a, b]
---
Hello world`;
    expect(stripFrontmatter(input)).toBe('Hello world');
  });

  it('returns content unchanged when no frontmatter exists', () => {
    const input = 'Just some text\nwith lines';
    expect(stripFrontmatter(input)).toBe(input);
  });

  it('handles empty frontmatter', () => {
    const input = `---
---
Content`;
    expect(stripFrontmatter(input)).toBe('Content');
  });
});

// ---------------------------------------------------------------------------
// splitSections
// ---------------------------------------------------------------------------

describe('splitSections', () => {
  it('splits by ## headings', () => {
    const input = `# Main Title

Intro text

## Section One

Content one

## Section Two

Content two`;
    const sections = splitSections(input);
    expect(sections).toHaveLength(3); // intro + 2 sections
    expect(sections[0].heading).toBe('');       // intro has no ## heading
    expect(sections[1].heading).toBe('Section One');
    expect(sections[2].heading).toBe('Section Two');
  });

  it('treats the whole note as one section when no ## headings exist', () => {
    const input = `# Only H1

Some content here

More content`;
    const sections = splitSections(input);
    expect(sections).toHaveLength(1);
    expect(sections[0].body).toContain('Some content here');
  });

  it('handles empty content', () => {
    const sections = splitSections('');
    expect(sections).toHaveLength(1);
    expect(sections[0].body).toBe('');
  });
});

// ---------------------------------------------------------------------------
// splitParagraphs
// ---------------------------------------------------------------------------

describe('splitParagraphs', () => {
  it('splits by double newlines', () => {
    const input = `First paragraph.

Second paragraph.

Third paragraph.`;
    const paragraphs = splitParagraphs(input);
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[0]).toBe('First paragraph.');
    expect(paragraphs[1]).toBe('Second paragraph.');
    expect(paragraphs[2]).toBe('Third paragraph.');
  });

  it('keeps code fences atomic (never splits inside)', () => {
    const input = `Before code.

\`\`\`javascript
function foo() {

  return bar;
}
\`\`\`

After code.`;
    const paragraphs = splitParagraphs(input);
    expect(paragraphs).toHaveLength(3);
    // The code block should be a single paragraph, including its internal blank line
    expect(paragraphs[1]).toContain('function foo()');
    expect(paragraphs[1]).toContain('return bar');
  });

  it('keeps Markdown tables atomic (never splits inside)', () => {
    const input = `Before table.

| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

After table.`;
    const paragraphs = splitParagraphs(input);
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[1]).toContain('Header 1');
    expect(paragraphs[1]).toContain('Cell 3');
  });

  it('handles 30 paragraphs correctly', () => {
    const parts: string[] = [];
    for (let i = 0; i < 30; i++) {
      parts.push(`Paragraph ${i} content.`);
    }
    const input = parts.join('\n\n');
    const paragraphs = splitParagraphs(input);
    expect(paragraphs).toHaveLength(30);
  });
});

// ---------------------------------------------------------------------------
// insertCalloutAfterParagraph
// ---------------------------------------------------------------------------

describe('insertCalloutAfterParagraph', () => {
  const callout = `> [!quote] Clip — 2026-06-19T14:22:29+02:00
> Some clipped text
> [clip-id:: test-id]`;

  it('inserts callout after the correct paragraph in the correct section', () => {
    const input = `---
title: Test
---
# Title

Intro paragraph.

## Section One

Para A.

Para B.

Para C.

## Section Two

Para D.`;

    // Insert after Para B (section index 1, paragraph index 1)
    const result = insertCalloutAfterParagraph(input, 1, 1, callout);
    
    // Para B should be followed by the callout
    const lines = result.split('\n');
    const paraBIndex = lines.indexOf('Para B.');
    expect(paraBIndex).toBeGreaterThan(-1);
    // Callout should appear after Para B, before Para C
    const afterParaB = result.slice(result.indexOf('Para B.') + 'Para B.'.length);
    expect(afterParaB).toContain(callout);
    // Para C should still exist after the callout
    expect(afterParaB).toContain('Para C.');
  });

  it('does not mutate any other content in the file', () => {
    const input = `## Only Section

First para.

Second para.

Third para.`;

    const result = insertCalloutAfterParagraph(input, 0, 0, callout);
    
    // All original paragraphs must still be present
    expect(result).toContain('First para.');
    expect(result).toContain('Second para.');
    expect(result).toContain('Third para.');
    // Callout is present
    expect(result).toContain(callout);
  });

  it('preserves frontmatter when inserting', () => {
    const input = `---
title: Keep Me
---
## Section

Para one.

Para two.`;

    const result = insertCalloutAfterParagraph(input, 0, 0, callout);
    expect(result).toContain('---\ntitle: Keep Me\n---');
    expect(result).toContain(callout);
  });
});
