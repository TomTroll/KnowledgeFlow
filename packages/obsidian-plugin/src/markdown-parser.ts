// packages/obsidian-plugin/src/markdown-parser.ts
// Pure utility functions for parsing Obsidian Markdown.
//
// Design:
//   - stripFrontmatter: remove YAML between leading --- delimiters
//   - splitSections:    split by ## headings
//   - splitParagraphs:  split by \n\n, keeping code fences and tables atomic
//   - insertCalloutAfterParagraph: reconstruct the file with a callout inserted

export interface Section {
  /** The heading text (without ##), or '' for the intro section. */
  heading: string;
  /** The body content of this section (without the heading line). */
  body: string;
}

/**
 * Remove YAML frontmatter enclosed between leading `---` delimiters.
 */
export function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  if (match) {
    return content.slice(match[0].length);
  }
  // Also handle empty frontmatter: ---\n---\n
  const emptyMatch = content.match(/^---\n---\n/);
  if (emptyMatch) {
    return content.slice(emptyMatch[0].length);
  }
  return content;
}

/**
 * Split Markdown content by `##` headings.
 * Returns at least one section. The first section has heading '' if there
 * is content before the first ## heading.
 */
export function splitSections(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];
  let currentHeading = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      // Push the previous section
      sections.push({
        heading: currentHeading,
        body: currentLines.join('\n').trim(),
      });
      currentHeading = headingMatch[1];
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Push the last section
  sections.push({
    heading: currentHeading,
    body: currentLines.join('\n').trim(),
  });

  // If the first section is empty and there are others, keep it only if
  // it has content (intro text)
  if (sections.length > 1 && sections[0].heading === '' && sections[0].body === '') {
    sections.shift();
  }

  return sections;
}

/**
 * Split a section body into paragraphs by double-newline (`\n\n`).
 * Code fences (``` ... ```) and Markdown tables are treated as atomic
 * units and never split internally.
 */
export function splitParagraphs(text: string): string[] {
  const lines = text.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let inCodeFence = false;
  let inTable = false;

  function flush() {
    const block = current.join('\n').trim();
    if (block) {
      blocks.push(block);
    }
    current = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track code fences
    if (line.trimStart().startsWith('```')) {
      if (!inCodeFence) {
        // Entering a code fence — flush any accumulated text first
        if (!inTable) flush();
        inCodeFence = true;
        current.push(line);
        continue;
      } else {
        // Closing a code fence
        current.push(line);
        inCodeFence = false;
        flush();
        continue;
      }
    }

    // Inside a code fence, accumulate everything
    if (inCodeFence) {
      current.push(line);
      continue;
    }

    // Track tables: a line starting with | is a table row
    const isTableLine = /^\|/.test(line.trim());
    if (isTableLine && !inTable) {
      // Starting a table — flush preceding text
      flush();
      inTable = true;
      current.push(line);
      continue;
    }
    if (inTable && isTableLine) {
      current.push(line);
      continue;
    }
    if (inTable && !isTableLine) {
      // Table ended
      inTable = false;
      flush();
      // Process this non-table line normally (fall through)
    }

    // Blank line outside code/table = paragraph boundary
    if (line.trim() === '') {
      if (current.length > 0) {
        flush();
      }
      continue;
    }

    current.push(line);
  }

  // Flush remaining
  flush();

  return blocks;
}

/**
 * Insert a callout block after a specific paragraph within a specific section.
 * Operates on the FULL file content (including frontmatter).
 *
 * @param fullContent  The complete Markdown file content.
 * @param sectionIdx   Zero-based index into the sections array (from splitSections
 *                     applied to the frontmatter-stripped content).
 * @param paraIdx      Zero-based index into the paragraphs array of that section.
 * @param callout      The formatted callout block to insert.
 * @returns            The reconstructed file content with the callout inserted.
 */
export function insertCalloutAfterParagraph(
  fullContent: string,
  sectionIdx: number,
  paraIdx: number,
  callout: string,
): string {
  // Separate frontmatter from body
  let frontmatter = '';
  let body = fullContent;
  const fmMatch = fullContent.match(/^(---\n[\s\S]*?\n---\n)/);
  if (fmMatch) {
    frontmatter = fmMatch[1];
    body = fullContent.slice(fmMatch[1].length);
  }

  const sections = splitSections(body);
  if (sectionIdx >= sections.length) {
    // Fallback: append to the end
    return fullContent + '\n\n' + callout;
  }

  const section = sections[sectionIdx];
  const paragraphs = splitParagraphs(section.body);
  const targetParaIdx = Math.min(paraIdx, paragraphs.length - 1);

  // Reconstruct the section body with the callout inserted
  const newParagraphs = [...paragraphs];
  newParagraphs.splice(targetParaIdx + 1, 0, callout);
  const newSectionBody = newParagraphs.join('\n\n');

  // Reconstruct the full body from sections
  const newSections = sections.map((s, i) => {
    const sectionBody = i === sectionIdx ? newSectionBody : s.body;
    if (s.heading) {
      return `## ${s.heading}\n\n${sectionBody}`;
    }
    return sectionBody;
  });

  return frontmatter + newSections.join('\n\n');
}
