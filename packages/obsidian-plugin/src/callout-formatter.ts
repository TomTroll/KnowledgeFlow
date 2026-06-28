// packages/obsidian-plugin/src/callout-formatter.ts
// Formats a ClipRequest into an Obsidian quote callout block.
//
// The callout format is fixed by the project spec:
//   > [!quote] Clip — <ISO timestamp>
//   > <selected_text>
//   >
//   > **Source:** [<page_title>](<source_url>)
//   > **Tags:** #tag1 #tag2
//   > **Comment:** <user_comment>
//   > [clip-id:: <uuid>]

import type { ClipRequest } from '@knowledgeflow/shared';

/**
 * Format a clip request and ID into an Obsidian callout block.
 *
 * @param req    The incoming clip request.
 * @param clipId A unique UUID for this clip (used for undo tracking).
 * @returns      The formatted callout block string.
 */
export function formatCallout(req: ClipRequest, clipId: string): string {
  const timestamp = new Date().toISOString();
  const tags = req.tags.map(t => `#${t}`).join(' ');

  const lines = [
    `> [!quote] Clip — ${timestamp}`,
    `> ${req.selectedText}`,
    `>`,
    `> **Source:** [${req.pageTitle}](${req.sourceUrl})`,
    `> **Tags:** ${tags}`,
    `> **Comment:** ${req.comment}`,
    `> [clip-id:: ${clipId}]`,
  ];

  return lines.join('\n');
}
