// packages/chrome-extension/src/ui/preview.ts
// KnowledgeFlow – Preview UI (Shadow DOM)
//
// showClipPopup() creates a host element attached to document.body, opens
// a Shadow DOM inside it, and renders the floating clip popup. All styles
// are fully isolated from the host page.
//
// Dispatch flow on Save:
//   1. Builds a payload: { selectedText, sourceUrl, pageTitle, tags, comment }
//   2. Fires a custom "kf:clip-save" DOM event on document (for Playwright tests
//      and for #9 to intercept and POST to the Obsidian plugin).

import POPUP_CSS from './style.css';

export interface ClipPayload {
  selectedText: string;
  sourceUrl: string;
  pageTitle: string;
  tags: string[];
  comment: string;
}

/**
 * Inject the floating Shadow DOM clip popup into the current page.
 *
 * @param selectedText - The raw text from window.getSelection()
 * @param sourceUrl    - Current page URL (location.href)
 * @param pageTitle    - Current page title (document.title)
 */
export function showClipPopup(
  selectedText: string,
  sourceUrl: string,
  pageTitle: string,
  selectionRect?: DOMRect,
): void {
  // Prevent duplicate popups
  if (document.getElementById('kf-clip-host')) return;

  // ── 1. Host element (anchor for the shadow root) ───────────────────────
  const host = document.createElement('div');
  host.id = 'kf-clip-host';
  // Positioned outside normal flow so layout is not disturbed
  Object.assign(host.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    zIndex: '2147483647',
    pointerEvents: 'none',
  });
  document.body.appendChild(host);

  // ── 2. Shadow root ─────────────────────────────────────────────────────
  const shadow = host.attachShadow({ mode: 'open' });

  // ── 3. Inject styles ───────────────────────────────────────────────────
  const styleEl = document.createElement('style');
  styleEl.textContent = POPUP_CSS;
  shadow.appendChild(styleEl);

  // ── 4. Build popup HTML ────────────────────────────────────────────────
  const preview = selectedText.slice(0, 100);

  const popup = document.createElement('div');
  popup.id = 'kf-popup';
  // Re-enable pointer events on the actual popup panel
  popup.style.pointerEvents = 'auto';

  popup.innerHTML = /* html */ `
    <div class="kf-header">
      <span class="kf-logo">✂️</span>
      <span class="kf-title">KnowledgeFlow</span>
      <button class="kf-close" id="kf-close-btn" aria-label="Dismiss">✕</button>
    </div>

    <div class="kf-preview">
      <span data-testid="preview-text">${escapeHtml(preview)}</span>
    </div>

    <div class="kf-field">
      <label class="kf-label" for="kf-tag-input">Tags</label>
      <input
        id="kf-tag-input"
        class="kf-input"
        type="text"
        placeholder="tag1, tag2 …"
        data-testid="tag-input"
        autocomplete="off"
      />
    </div>

    <button class="kf-comment-toggle" id="kf-comment-toggle">
      <i class="kf-comment-arrow" id="kf-comment-arrow">▶</i>
      Add a comment
    </button>
    <div id="kf-comment-wrap">
      <textarea
        id="kf-comment"
        class="kf-textarea"
        data-testid="comment-input"
        placeholder="Optional note about this clip…"
      ></textarea>
    </div>

    <div class="kf-actions">
      <button class="kf-mic" id="kf-mic-btn" aria-label="Voice comment" title="Transcribe voice to comment">🎙️</button>
      <button class="kf-save" id="kf-save-btn" data-testid="save-button">Save clip</button>
    </div>
  `;

  shadow.appendChild(popup);

  // ── 5. Position popup near the selection (or fall back to bottom-right) ────
  const POPUP_WIDTH = 360;
  const POPUP_ESTIMATED_HEIGHT = 270;
  const GAP = 10;

  if (selectionRect && selectionRect.width > 0) {
    // Center horizontally over the selection
    let left = selectionRect.left + selectionRect.width / 2 - POPUP_WIDTH / 2;
    // Prefer showing ABOVE the selection (like Edge's mini toolbar)
    let top = selectionRect.top - POPUP_ESTIMATED_HEIGHT - GAP;

    if (top < 8) {
      // Not enough space above — flip below
      top = selectionRect.bottom + GAP;
    }

    // Clamp horizontally so popup never overflows the viewport
    left = Math.max(8, Math.min(left, window.innerWidth - POPUP_WIDTH - 8));

    popup.style.position = 'fixed';
    popup.style.bottom = 'auto';
    popup.style.right = 'auto';
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  }

  // ── 6. Wire up dismiss logic ───────────────────────────────────────────
  function dismiss(): void {
    host.remove();
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('mousedown', onMouseDown);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') dismiss();
  }

  function onMouseDown(e: MouseEvent): void {
    // If the click target is inside the shadow host, do nothing
    if (e.composedPath().includes(host)) return;
    dismiss();
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('mousedown', onMouseDown);

  shadow.getElementById('kf-close-btn')!.addEventListener('click', dismiss);

  // ── 6. Comment toggle ──────────────────────────────────────────────────
  shadow.getElementById('kf-comment-toggle')!.addEventListener('click', () => {
    const wrap = shadow.getElementById('kf-comment-wrap')!;
    const arrow = shadow.getElementById('kf-comment-arrow')!;
    const isOpen = wrap.classList.toggle('open');
    arrow.classList.toggle('open', isOpen);
  });

  // ── 7. Microphone toggle (Web Speech API) ─────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recognition: any = null;

  shadow.getElementById('kf-mic-btn')!.addEventListener('click', () => {
    const micBtn = shadow.getElementById('kf-mic-btn')!;
    const commentTextarea = shadow.getElementById('kf-comment') as HTMLTextAreaElement;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionCtor: (new () => any) | undefined =
      w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      commentTextarea.placeholder = '⛔ Speech recognition not supported in this browser.';
      return;
    }

    if (recognition) {
      recognition.stop();
      recognition = null;
      micBtn.classList.remove('active');
      return;
    }

    // Open the comment section so the user can see transcription
    const wrap = shadow.getElementById('kf-comment-wrap')!;
    const arrow = shadow.getElementById('kf-comment-arrow')!;
    if (!wrap.classList.contains('open')) {
      wrap.classList.add('open');
      arrow.classList.add('open');
    }

    recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = navigator.language;

    recognition.onresult = (event: any) => {
      // In continuous mode, event.results is a cumulative SpeechRecognitionResultList
      // that grows with each utterance. Only read the *new* result at resultIndex
      // to avoid appending every previous phrase again on each callback.
      const newTranscript = (event.results[event.resultIndex][0] as { transcript: string }).transcript;
      commentTextarea.value = (commentTextarea.value + ' ' + newTranscript).trim();
    };

    recognition.onend = () => {
      micBtn.classList.remove('active');
      recognition = null;
    };

    recognition.onerror = () => {
      micBtn.classList.remove('active');
      recognition = null;
    };

    recognition.start();
    micBtn.classList.add('active');
  });

  // ── 8. Save button ─────────────────────────────────────────────────────
  shadow.getElementById('kf-save-btn')!.addEventListener('click', () => {
    const tagRaw = (shadow.getElementById('kf-tag-input') as HTMLInputElement).value;
    const comment = (shadow.getElementById('kf-comment') as HTMLTextAreaElement).value;

    const tags = tagRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: ClipPayload = {
      selectedText,
      sourceUrl,
      pageTitle,
      tags,
      comment,
    };

    // Emit for Playwright tests and for the submission handler (#9)
    document.dispatchEvent(new CustomEvent('kf:clip-save', { detail: payload }));

    dismiss();
  });

  // ── 9. Focus tag input for quick entry ────────────────────────────────
  // Slight delay to let the popup animation settle
  setTimeout(() => {
    (shadow.getElementById('kf-tag-input') as HTMLInputElement | null)?.focus();
  }, 50);
}

// ── Utility ────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


