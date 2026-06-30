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

    <div class="kf-field">
      <label class="kf-label" for="kf-comment">Comment</label>
      <textarea
        id="kf-comment"
        class="kf-textarea"
        data-testid="comment-input"
        placeholder="Optional note about this clip…"
      ></textarea>
    </div>

    <div class="kf-actions">
      <button class="kf-mic" id="kf-mic-btn" aria-label="Voice comment" title="Transcribe voice to comment">
        <img src="${chrome.runtime.getURL('assets/mic-16.png')}" alt="Mic" style="width: 16px; height: 16px; pointer-events: none; display: block;" />
      </button>
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
  let dismiss = function(): void {
    host.remove();
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('mousedown', onMouseDown);
  };

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

    // Show loading spinner
    const saveBtn = shadow.getElementById('kf-save-btn') as HTMLButtonElement;
    saveBtn.style.display = 'none';

    let spinner = shadow.getElementById('kf-spinner');
    if (!spinner) {
      spinner = document.createElement('div');
      spinner.id = 'kf-spinner';
      spinner.className = 'kf-spinner';
      spinner.dataset.testid = 'loading-spinner';
      saveBtn.parentElement!.appendChild(spinner);
    }
    spinner.style.display = 'block';

    // Emit for Playwright tests and for the submission handler (#9)
    document.dispatchEvent(new CustomEvent('kf:clip-save', { detail: payload }));
  });

  // ── 9. Submission Feedback (Issue #9) ──────────────────────────────────
  function onSuccess(e: Event) {
    const data = (e as CustomEvent).detail;
    
    // Hide spinner
    const spinner = shadow.getElementById('kf-spinner');
    if (spinner) spinner.style.display = 'none';

    // Show success toast
    const toast = document.createElement('div');
    toast.className = 'kf-toast kf-toast-success';
    toast.dataset.testid = 'toast-success';
    toast.innerHTML = `
      <div class="kf-toast-title">✅ Saved to ${escapeHtml(data.matchedPath)}</div>
      ${data.justification ? `<div class="kf-toast-desc">${escapeHtml(data.justification)}</div>` : ''}
    `;
    
    // Insert toast before actions
    const actions = shadow.querySelector('.kf-actions');
    actions?.parentElement?.insertBefore(toast, actions);

    // Dismiss after 2 seconds
    setTimeout(dismiss, 2000);
  }

  function onError(e: Event) {
    const data = (e as CustomEvent).detail;
    
    // Hide spinner and show save button
    const spinner = shadow.getElementById('kf-spinner');
    if (spinner) spinner.style.display = 'none';
    const saveBtn = shadow.getElementById('kf-save-btn') as HTMLButtonElement;
    if (saveBtn) saveBtn.style.display = 'block';

    // Remove existing error toast if any
    const existing = shadow.querySelector('[data-testid="toast-error"]');
    if (existing) existing.remove();

    // Show error toast
    const toast = document.createElement('div');
    toast.className = 'kf-toast kf-toast-error';
    toast.dataset.testid = 'toast-error';
    toast.innerHTML = `
      <div class="kf-toast-title">❌ Failed to Save</div>
      <div class="kf-toast-desc">${escapeHtml(data.message)}</div>
      <div class="kf-toast-desc" style="opacity: 0.8; margin-top: 4px; font-size: 11px;">Please try again.</div>
    `;
    
    // Insert toast before actions
    const actions = shadow.querySelector('.kf-actions');
    actions?.parentElement?.insertBefore(toast, actions);
  }

  function onQueued() {
    // Remove existing error/success toast if any
    shadow.querySelector('[data-testid="toast-error"]')?.remove();
    shadow.querySelector('[data-testid="toast-success"]')?.remove();
    const existing = shadow.querySelector('[data-testid="toast-queued"]');
    if (existing) return; // already showing

    // Show queued toast banner
    const toast = document.createElement('div');
    toast.className = 'kf-toast kf-toast-info';
    toast.dataset.testid = 'toast-queued';
    toast.innerHTML = `
      <div class="kf-toast-title">⏳ Rate limit reached</div>
      <div class="kf-toast-desc">Waiting in queue...</div>
    `;
    
    // Insert toast before actions
    const actions = shadow.querySelector('.kf-actions');
    actions?.parentElement?.insertBefore(toast, actions);
  }

  document.addEventListener('kf:clip-success', onSuccess, { once: true });
  document.addEventListener('kf:clip-error', onError);
  document.addEventListener('kf:clip-queued', onQueued);

  // Make sure to remove listener if dismissed early
  const originalDismiss = dismiss;
  dismiss = function() {
    document.removeEventListener('kf:clip-success', onSuccess);
    document.removeEventListener('kf:clip-error', onError);
    document.removeEventListener('kf:clip-queued', onQueued);
    originalDismiss();
  };

  // ── 10. Focus tag input for quick entry ────────────────────────────────
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


