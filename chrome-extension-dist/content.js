"use strict";
(() => {
  // src/ui/style.css
  var style_default = `/* KnowledgeFlow \u2013 Shadow DOM Styles
 * These styles are scoped inside the Shadow DOM and will
 * never bleed into or be affected by the host page CSS. */

/* -----------------------------------------------------------------------
 * Reset & base \u2014 everything inside the shadow root starts fresh
 * ----------------------------------------------------------------------- */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* -----------------------------------------------------------------------
 * Popup panel
 * ----------------------------------------------------------------------- */
#kf-popup {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2147483647; /* max z-index */

  width: 360px;
  background: #1e1e2e;
  border: 1px solid rgba(139, 92, 246, 0.4);
  border-radius: 12px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(139, 92, 246, 0.15);
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  color: #cdd6f4;
  animation: kf-slide-in 0.18s ease-out;
}

@keyframes kf-slide-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* -----------------------------------------------------------------------
 * Header row
 * ----------------------------------------------------------------------- */
.kf-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.kf-logo {
  font-size: 16px;
}

.kf-title {
  flex: 1;
  font-weight: 600;
  font-size: 13px;
  color: #a6adc8;
  letter-spacing: 0.02em;
}

.kf-close {
  background: none;
  border: none;
  color: #6c7086;
  font-size: 16px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1;
  transition: color 0.15s, background 0.15s;
}
.kf-close:hover {
  color: #cdd6f4;
  background: rgba(255, 255, 255, 0.06);
}

/* -----------------------------------------------------------------------
 * Selection preview
 * ----------------------------------------------------------------------- */
.kf-preview {
  background: rgba(137, 180, 250, 0.06);
  border-left: 3px solid #89b4fa;
  border-radius: 0 6px 6px 0;
  padding: 8px 10px;
  margin-bottom: 12px;
  font-size: 12px;
  line-height: 1.5;
  color: #bac2de;
  word-break: break-word;
}

/* -----------------------------------------------------------------------
 * Tag input
 * ----------------------------------------------------------------------- */
.kf-field {
  margin-bottom: 10px;
}

.kf-label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: #6c7086;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.kf-input {
  width: 100%;
  background: #313244;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #cdd6f4;
  font-size: 12px;
  padding: 6px 10px;
  outline: none;
  transition: border-color 0.15s;
  font-family: inherit;
}
.kf-input:focus {
  border-color: rgba(137, 180, 250, 0.5);
}
.kf-input::placeholder {
  color: #45475a;
}

/* -----------------------------------------------------------------------
 * Comment section (collapsible)
 * ----------------------------------------------------------------------- */
.kf-comment-toggle {
  background: none;
  border: none;
  color: #6c7086;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: color 0.15s;
  font-family: inherit;
}
.kf-comment-toggle:hover {
  color: #89b4fa;
}

.kf-comment-arrow {
  display: inline-block;
  transition: transform 0.2s;
  font-style: normal;
}
.kf-comment-arrow.open {
  transform: rotate(90deg);
}

#kf-comment-wrap {
  display: none;
  margin-bottom: 10px;
}
#kf-comment-wrap.open {
  display: block;
}

.kf-textarea {
  width: 100%;
  background: #313244;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #cdd6f4;
  font-size: 12px;
  padding: 6px 10px;
  outline: none;
  resize: vertical;
  min-height: 56px;
  font-family: inherit;
  transition: border-color 0.15s;
}
.kf-textarea:focus {
  border-color: rgba(137, 180, 250, 0.5);
}

/* -----------------------------------------------------------------------
 * Action row
 * ----------------------------------------------------------------------- */
.kf-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 4px;
}

.kf-mic {
  background: #313244;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #6c7086;
  font-size: 16px;
  padding: 5px 9px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
  line-height: 1;
}
.kf-mic:hover {
  color: #cdd6f4;
  background: #45475a;
}
.kf-mic.active {
  color: #f38ba8;
  border-color: rgba(243, 139, 168, 0.4);
  background: rgba(243, 139, 168, 0.08);
}

.kf-save {
  flex: 1;
  background: linear-gradient(135deg, #7c3aed, #6366f1);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 16px;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  font-family: inherit;
  letter-spacing: 0.01em;
}
.kf-save:hover {
  opacity: 0.88;
}
.kf-save:active {
  transform: scale(0.97);
}

.kf-spinner {
  flex: 1;
  display: none;
  height: 29px; /* Matches Save button height */
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.kf-spinner::after {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  animation: kf-shimmer 1.5s infinite;
}

@keyframes kf-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* -----------------------------------------------------------------------
 * Toasts (Success / Error / Info)
 * ----------------------------------------------------------------------- */
.kf-toast {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 12px;
  animation: kf-slide-in 0.2s ease-out;
}

.kf-toast-success {
  background: rgba(166, 227, 161, 0.1);
  border: 1px solid rgba(166, 227, 161, 0.3);
  color: #a6e3a1;
}

.kf-toast-error {
  background: rgba(243, 139, 168, 0.1);
  border: 1px solid rgba(243, 139, 168, 0.3);
  color: #f38ba8;
}

.kf-toast-info {
  background: rgba(137, 180, 250, 0.1);
  border: 1px solid rgba(137, 180, 250, 0.3);
  color: #89b4fa;
}

.kf-toast-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.kf-toast-desc {
  color: #cdd6f4;
  line-height: 1.4;
}

`;

  // src/ui/preview.ts
  function showClipPopup(selectedText, sourceUrl, pageTitle, selectionRect) {
    if (document.getElementById("kf-clip-host")) return;
    const host = document.createElement("div");
    host.id = "kf-clip-host";
    Object.assign(host.style, {
      position: "fixed",
      top: "0",
      left: "0",
      zIndex: "2147483647",
      pointerEvents: "none"
    });
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const styleEl = document.createElement("style");
    styleEl.textContent = style_default;
    shadow.appendChild(styleEl);
    const preview = selectedText.slice(0, 100);
    const popup = document.createElement("div");
    popup.id = "kf-popup";
    popup.style.pointerEvents = "auto";
    popup.innerHTML = /* html */
    `
    <div class="kf-header">
      <span class="kf-logo">\u2702\uFE0F</span>
      <span class="kf-title">KnowledgeFlow</span>
      <button class="kf-close" id="kf-close-btn" aria-label="Dismiss">\u2715</button>
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
        placeholder="tag1, tag2 \u2026"
        data-testid="tag-input"
        autocomplete="off"
      />
    </div>

    <button class="kf-comment-toggle" id="kf-comment-toggle">
      <i class="kf-comment-arrow" id="kf-comment-arrow">\u25B6</i>
      Add a comment
    </button>
    <div id="kf-comment-wrap">
      <textarea
        id="kf-comment"
        class="kf-textarea"
        data-testid="comment-input"
        placeholder="Optional note about this clip\u2026"
      ></textarea>
    </div>

    <div class="kf-actions">
      <button class="kf-mic" id="kf-mic-btn" aria-label="Voice comment" title="Transcribe voice to comment">\u{1F399}\uFE0F</button>
      <button class="kf-save" id="kf-save-btn" data-testid="save-button">Save clip</button>
    </div>
  `;
    shadow.appendChild(popup);
    const POPUP_WIDTH = 360;
    const POPUP_ESTIMATED_HEIGHT = 270;
    const GAP = 10;
    if (selectionRect && selectionRect.width > 0) {
      let left = selectionRect.left + selectionRect.width / 2 - POPUP_WIDTH / 2;
      let top = selectionRect.top - POPUP_ESTIMATED_HEIGHT - GAP;
      if (top < 8) {
        top = selectionRect.bottom + GAP;
      }
      left = Math.max(8, Math.min(left, window.innerWidth - POPUP_WIDTH - 8));
      popup.style.position = "fixed";
      popup.style.bottom = "auto";
      popup.style.right = "auto";
      popup.style.top = `${top}px`;
      popup.style.left = `${left}px`;
    }
    let dismiss = function() {
      host.remove();
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
    function onKeyDown(e) {
      if (e.key === "Escape") dismiss();
    }
    function onMouseDown(e) {
      if (e.composedPath().includes(host)) return;
      dismiss();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    shadow.getElementById("kf-close-btn").addEventListener("click", dismiss);
    shadow.getElementById("kf-comment-toggle").addEventListener("click", () => {
      const wrap = shadow.getElementById("kf-comment-wrap");
      const arrow = shadow.getElementById("kf-comment-arrow");
      const isOpen = wrap.classList.toggle("open");
      arrow.classList.toggle("open", isOpen);
    });
    let recognition = null;
    shadow.getElementById("kf-mic-btn").addEventListener("click", () => {
      const micBtn = shadow.getElementById("kf-mic-btn");
      const commentTextarea = shadow.getElementById("kf-comment");
      const w = window;
      const SpeechRecognitionCtor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (!SpeechRecognitionCtor) {
        commentTextarea.placeholder = "\u26D4 Speech recognition not supported in this browser.";
        return;
      }
      if (recognition) {
        recognition.stop();
        recognition = null;
        micBtn.classList.remove("active");
        return;
      }
      const wrap = shadow.getElementById("kf-comment-wrap");
      const arrow = shadow.getElementById("kf-comment-arrow");
      if (!wrap.classList.contains("open")) {
        wrap.classList.add("open");
        arrow.classList.add("open");
      }
      recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = navigator.language;
      recognition.onresult = (event) => {
        const newTranscript = event.results[event.resultIndex][0].transcript;
        commentTextarea.value = (commentTextarea.value + " " + newTranscript).trim();
      };
      recognition.onend = () => {
        micBtn.classList.remove("active");
        recognition = null;
      };
      recognition.onerror = () => {
        micBtn.classList.remove("active");
        recognition = null;
      };
      recognition.start();
      micBtn.classList.add("active");
    });
    shadow.getElementById("kf-save-btn").addEventListener("click", () => {
      const tagRaw = shadow.getElementById("kf-tag-input").value;
      const comment = shadow.getElementById("kf-comment").value;
      const tags = tagRaw.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        selectedText,
        sourceUrl,
        pageTitle,
        tags,
        comment
      };
      const saveBtn = shadow.getElementById("kf-save-btn");
      saveBtn.style.display = "none";
      let spinner = shadow.getElementById("kf-spinner");
      if (!spinner) {
        spinner = document.createElement("div");
        spinner.id = "kf-spinner";
        spinner.className = "kf-spinner";
        spinner.dataset.testid = "loading-spinner";
        saveBtn.parentElement.appendChild(spinner);
      }
      spinner.style.display = "block";
      document.dispatchEvent(new CustomEvent("kf:clip-save", { detail: payload }));
    });
    function onSuccess(e) {
      const data = e.detail;
      const spinner = shadow.getElementById("kf-spinner");
      if (spinner) spinner.style.display = "none";
      const toast = document.createElement("div");
      toast.className = "kf-toast kf-toast-success";
      toast.dataset.testid = "toast-success";
      toast.innerHTML = `
      <div class="kf-toast-title">\u2705 Saved to ${escapeHtml(data.matchedPath)}</div>
      ${data.justification ? `<div class="kf-toast-desc">${escapeHtml(data.justification)}</div>` : ""}
    `;
      const actions = shadow.querySelector(".kf-actions");
      actions?.parentElement?.insertBefore(toast, actions);
      setTimeout(dismiss, 2e3);
    }
    function onError(e) {
      const data = e.detail;
      const spinner = shadow.getElementById("kf-spinner");
      if (spinner) spinner.style.display = "none";
      const saveBtn = shadow.getElementById("kf-save-btn");
      if (saveBtn) saveBtn.style.display = "block";
      const existing = shadow.querySelector('[data-testid="toast-error"]');
      if (existing) existing.remove();
      const toast = document.createElement("div");
      toast.className = "kf-toast kf-toast-error";
      toast.dataset.testid = "toast-error";
      toast.innerHTML = `
      <div class="kf-toast-title">\u274C Failed to Save</div>
      <div class="kf-toast-desc">${escapeHtml(data.message)}</div>
      <div class="kf-toast-desc" style="opacity: 0.8; margin-top: 4px; font-size: 11px;">Please try again.</div>
    `;
      const actions = shadow.querySelector(".kf-actions");
      actions?.parentElement?.insertBefore(toast, actions);
    }
    function onQueued() {
      shadow.querySelector('[data-testid="toast-error"]')?.remove();
      shadow.querySelector('[data-testid="toast-success"]')?.remove();
      const existing = shadow.querySelector('[data-testid="toast-queued"]');
      if (existing) return;
      const toast = document.createElement("div");
      toast.className = "kf-toast kf-toast-info";
      toast.dataset.testid = "toast-queued";
      toast.innerHTML = `
      <div class="kf-toast-title">\u23F3 Rate limit reached</div>
      <div class="kf-toast-desc">Waiting in queue...</div>
    `;
      const actions = shadow.querySelector(".kf-actions");
      actions?.parentElement?.insertBefore(toast, actions);
    }
    document.addEventListener("kf:clip-success", onSuccess, { once: true });
    document.addEventListener("kf:clip-error", onError);
    document.addEventListener("kf:clip-queued", onQueued);
    const originalDismiss = dismiss;
    dismiss = function() {
      document.removeEventListener("kf:clip-success", onSuccess);
      document.removeEventListener("kf:clip-error", onError);
      document.removeEventListener("kf:clip-queued", onQueued);
      originalDismiss();
    };
    setTimeout(() => {
      shadow.getElementById("kf-tag-input")?.focus();
    }, 50);
  }
  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // src/content.ts
  function triggerFromSelection(rect) {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? "";
    if (!selectedText) return;
    showClipPopup(selectedText, location.href, document.title, rect);
  }
  function getSelectionRect() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return void 0;
    return selection.getRangeAt(0).getBoundingClientRect();
  }
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== "show-clip-popup") return;
    triggerFromSelection(getSelectionRect());
  });
  document.addEventListener("mouseup", () => {
    setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim() ?? "";
      if (selectedText.length < 3) return;
      if (document.getElementById("kf-clip-host")) return;
      triggerFromSelection(getSelectionRect());
    }, 50);
  });
  document.addEventListener("kf:clip-save", async (e) => {
    const payload = e.detail;
    chrome.storage.sync.get({ port: 37321, token: "" }, async (settings) => {
      try {
        const response = await fetch(`http://127.0.0.1:${settings.port}/clip`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.token}`
          },
          body: JSON.stringify(payload)
        });
        if (response.status === 202) {
          document.dispatchEvent(new CustomEvent("kf:clip-queued"));
          const poll = setInterval(async () => {
            try {
              const statusRes = await fetch(`http://127.0.0.1:${settings.port}/status`, {
                headers: { Authorization: `Bearer ${settings.token}` }
              });
              const statusData = await statusRes.json();
              if (statusData.queuedClips === 0) {
                clearInterval(poll);
                const clipsRes = await fetch(`http://127.0.0.1:${settings.port}/clips`, {
                  headers: { Authorization: `Bearer ${settings.token}` }
                });
                const clipsData = await clipsRes.json();
                document.dispatchEvent(new CustomEvent("kf:clip-success", { detail: clipsData.clips[0] || { matchedPath: "Saved", justification: "" } }));
              }
            } catch (e2) {
            }
          }, 1e3);
          return;
        }
        if (response.ok) {
          const data = await response.json();
          document.dispatchEvent(new CustomEvent("kf:clip-success", { detail: data }));
        } else {
          const errData = await response.json().catch(() => null);
          const errMsg = errData?.error || `Server returned ${response.status}`;
          document.dispatchEvent(new CustomEvent("kf:clip-error", { detail: { message: errMsg } }));
        }
      } catch (err) {
        document.dispatchEvent(new CustomEvent("kf:clip-error", { detail: { message: err.message || "Network error" } }));
      }
    });
  });
  window.__kfTrigger = () => triggerFromSelection(getSelectionRect());
})();
//# sourceMappingURL=content.js.map
