// packages/chrome-extension/src/content.ts
// KnowledgeFlow – Content Script
//
// Two ways to trigger the clip popup:
//   1. Keyboard shortcut (Ctrl/Cmd+Shift+S) — background SW sends "show-clip-popup"
//   2. Auto-popup on text selection — mouseup listener, like Edge's mini toolbar
//
// In both cases the selection's bounding rect is forwarded to showClipPopup()
// so the popup appears near the selected text instead of a fixed corner.

import { showClipPopup, ClipPayload } from './ui/preview.js';

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

// ── 3. Clip Submission Handler ──────────────────────────────────────────────
document.addEventListener('kf:clip-save', async (e: Event) => {
  const payload = (e as CustomEvent<ClipPayload>).detail;

  chrome.storage.sync.get({ port: 37321, token: '' }, async (settings) => {
    try {
      const response = await fetch(`http://127.0.0.1:${settings.port}/clip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 202) {
        const queuedData = await response.json().catch(() => null);
        if (queuedData?.retryAfter) {
          chrome.storage.local.set({ retryAfter: queuedData.retryAfter });
        }
        
        document.dispatchEvent(new CustomEvent('kf:clip-queued'));
        
        const poll = setInterval(async () => {
          try {
            const statusRes = await fetch(`http://127.0.0.1:${settings.port}/status`, {
              headers: { Authorization: `Bearer ${settings.token}` }
            });
            const statusData = await statusRes.json();
            if (statusData.queuedClips === 0) {
              clearInterval(poll);
              chrome.storage.local.remove('retryAfter');
              const clipsRes = await fetch(`http://127.0.0.1:${settings.port}/clips`, {
                headers: { Authorization: `Bearer ${settings.token}` }
              });
              const clipsData = await clipsRes.json();
              document.dispatchEvent(new CustomEvent('kf:clip-success', { detail: clipsData.clips[0] || { matchedPath: 'Saved', justification: '' } }));
            }
          } catch (e) {}
        }, 1000);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        document.dispatchEvent(new CustomEvent('kf:clip-success', { detail: data }));
      } else {
        const errData = await response.json().catch(() => null);
        const errMsg = errData?.error || `Server returned ${response.status}`;
        document.dispatchEvent(new CustomEvent('kf:clip-error', { detail: { message: errMsg } }));
      }
    } catch (err: any) {
      document.dispatchEvent(new CustomEvent('kf:clip-error', { detail: { message: err.message || 'Network error' } }));
    }
  });
});

// ── Test hook ───────────────────────────────────────────────────────────────
(window as unknown as { __kfTrigger: () => void }).__kfTrigger = () =>
  triggerFromSelection(getSelectionRect());
