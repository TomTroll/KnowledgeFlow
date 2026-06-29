// packages/chrome-extension/src/content.ts
// KnowledgeFlow – Content Script
//
// Two ways to trigger the clip popup:
//   1. Keyboard shortcut (Ctrl/Cmd+Shift+S) — background SW sends "show-clip-popup"
//   2. Auto-popup on text selection — mouseup listener, like Edge's mini toolbar
//
// In both cases the selection's bounding rect is forwarded to showClipPopup()
// so the popup appears near the selected text instead of a fixed corner.

import { showClipPopup } from './ui/preview.js';

/** Read the current selection and show the popup near it, if there is text. */
function triggerFromSelection(rect?: DOMRect): void {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() ?? '';
  if (!selectedText) return;
  showClipPopup(selectedText, location.href, document.title, rect);
}

/** Get the bounding rect of the current selection range (viewport-relative). */
function getSelectionRect(): DOMRect | undefined {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return undefined;
  return selection.getRangeAt(0).getBoundingClientRect();
}

// ── 1. Keyboard shortcut ────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: { type: string }) => {
  if (message.type !== 'show-clip-popup') return;
  triggerFromSelection(getSelectionRect());
});

// ── 2. Auto-popup on text selection (mouseup) ───────────────────────────────
// Mirrors Edge's behaviour: a small toolbar appears above selected text.
// Uses mouseup instead of selectionchange to avoid triggering mid-drag.
document.addEventListener('mouseup', () => {
  // Small delay so the browser finalises the selection after the event fires.
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? '';

    // Require at least 3 chars to avoid triggering on accidental single-clicks
    if (selectedText.length < 3) return;

    // Don't open a second popup if one is already visible
    if (document.getElementById('kf-clip-host')) return;

    triggerFromSelection(getSelectionRect());
  }, 50);
});

// ── Test hook ───────────────────────────────────────────────────────────────
(window as unknown as { __kfTrigger: () => void }).__kfTrigger = () =>
  triggerFromSelection(getSelectionRect());
