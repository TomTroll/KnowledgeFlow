"use strict";
(() => {
  // src/ui/style.css
  var style_default = '/* KnowledgeFlow \u2013 Shadow DOM Styles\r\n * These styles are scoped inside the Shadow DOM and will\r\n * never bleed into or be affected by the host page CSS. */\r\n\r\n:host {\r\n  /* Obsidian aesthetic & Material 3 variables */\r\n  --md-sys-color-background: #1e1e1e;\r\n  --md-sys-color-surface: #2b2b2b;\r\n  --md-sys-color-surface-variant: #363636;\r\n  --md-sys-color-primary: #a78bfa; /* Brighter purple for better dark-mode legibility */\r\n  --md-sys-color-on-primary: #11111b; /* Dark text on bright primary button */\r\n  --md-sys-color-on-background: #dcddde;\r\n  --md-sys-color-on-surface: #dcddde;\r\n  --md-sys-color-on-surface-variant: #999999;\r\n  --md-sys-color-error: #f38ba8;\r\n  --md-sys-color-on-error: #11111b;\r\n\r\n  --md-sys-shape-corner-small: 4px;\r\n  --md-sys-shape-corner-medium: 8px;\r\n  --md-sys-shape-corner-large: 12px;\r\n  --md-sys-shape-corner-full: 100px;\r\n  \r\n  --md-sys-typescale-body-medium: 400 13px/20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;\r\n  --md-sys-typescale-title-small: 600 14px/20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;\r\n  --md-sys-typescale-label-small: 500 11px/16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;\r\n}\r\n\r\n/* -----------------------------------------------------------------------\r\n * Reset & base \u2014 everything inside the shadow root starts fresh\r\n * ----------------------------------------------------------------------- */\r\n*,\r\n*::before,\r\n*::after {\r\n  box-sizing: border-box;\r\n  margin: 0;\r\n  padding: 0;\r\n}\r\n\r\n/* -----------------------------------------------------------------------\r\n * Popup panel\r\n * ----------------------------------------------------------------------- */\r\n#kf-popup {\r\n  position: fixed;\r\n  bottom: 24px;\r\n  right: 24px;\r\n  z-index: 2147483647; /* max z-index */\r\n\r\n  width: 360px;\r\n  background: var(--md-sys-color-background);\r\n  border: 1px solid rgba(167, 139, 250, 0.4);\r\n  border-radius: var(--md-sys-shape-corner-large);\r\n  box-shadow:\r\n    0 8px 32px rgba(0, 0, 0, 0.6),\r\n    0 0 0 1px rgba(167, 139, 250, 0.15);\r\n  padding: 16px;\r\n  font: var(--md-sys-typescale-body-medium);\r\n  color: var(--md-sys-color-on-background);\r\n  animation: kf-slide-in 0.18s ease-out;\r\n}\r\n\r\n@keyframes kf-slide-in {\r\n  from {\r\n    opacity: 0;\r\n    transform: translateY(12px);\r\n  }\r\n  to {\r\n    opacity: 1;\r\n    transform: translateY(0);\r\n  }\r\n}\r\n\r\n/* -----------------------------------------------------------------------\r\n * Header row\r\n * ----------------------------------------------------------------------- */\r\n.kf-header {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  margin-bottom: 12px;\r\n}\r\n\r\n.kf-logo {\r\n  font-size: 16px;\r\n}\r\n\r\n.kf-title {\r\n  flex: 1;\r\n  font: var(--md-sys-typescale-title-small);\r\n  color: var(--md-sys-color-on-background);\r\n  letter-spacing: 0.02em;\r\n}\r\n\r\n.kf-close {\r\n  background: none;\r\n  border: none;\r\n  color: var(--md-sys-color-on-surface-variant);\r\n  font-size: 16px;\r\n  cursor: pointer;\r\n  padding: 2px 6px;\r\n  border-radius: var(--md-sys-shape-corner-small);\r\n  line-height: 1;\r\n  transition: color 0.15s, background 0.15s;\r\n}\r\n.kf-close:hover {\r\n  color: var(--md-sys-color-on-background);\r\n  background: rgba(255, 255, 255, 0.06);\r\n}\r\n\r\n/* -----------------------------------------------------------------------\r\n * Selection preview\r\n * ----------------------------------------------------------------------- */\r\n.kf-preview {\r\n  background: rgba(167, 139, 250, 0.06);\r\n  border-left: 3px solid var(--md-sys-color-primary);\r\n  border-radius: 0 var(--md-sys-shape-corner-medium) var(--md-sys-shape-corner-medium) 0;\r\n  padding: 8px 10px;\r\n  margin-bottom: 12px;\r\n  font-size: 12px;\r\n  line-height: 1.5;\r\n  color: var(--md-sys-color-on-surface);\r\n  word-break: break-word;\r\n}\r\n\r\n/* -----------------------------------------------------------------------\r\n * Tag input\r\n * ----------------------------------------------------------------------- */\r\n.kf-field {\r\n  margin-bottom: 10px;\r\n}\r\n\r\n.kf-label {\r\n  display: block;\r\n  font: var(--md-sys-typescale-label-small);\r\n  color: var(--md-sys-color-on-surface-variant);\r\n  margin-bottom: 4px;\r\n  text-transform: uppercase;\r\n  letter-spacing: 0.05em;\r\n}\r\n\r\n.kf-input {\r\n  width: 100%;\r\n  background: var(--md-sys-color-surface-variant);\r\n  border: 1px solid rgba(255, 255, 255, 0.08);\r\n  border-radius: var(--md-sys-shape-corner-medium);\r\n  color: var(--md-sys-color-on-surface);\r\n  padding: 6px 10px;\r\n  outline: none;\r\n  transition: border-color 0.15s;\r\n  font: var(--md-sys-typescale-body-medium);\r\n}\r\n.kf-input:focus {\r\n  border-color: rgba(167, 139, 250, 0.5);\r\n}\r\n.kf-input::placeholder {\r\n  color: var(--md-sys-color-on-surface-variant);\r\n}\r\n\r\n/* -----------------------------------------------------------------------\r\n * Comment section (collapsible)\r\n * ----------------------------------------------------------------------- */\r\n\r\n\r\n.kf-textarea {\r\n  width: 100%;\r\n  background: var(--md-sys-color-surface-variant);\r\n  border: 1px solid rgba(255, 255, 255, 0.08);\r\n  border-radius: var(--md-sys-shape-corner-medium);\r\n  color: var(--md-sys-color-on-surface);\r\n  padding: 6px 10px;\r\n  outline: none;\r\n  resize: vertical;\r\n  min-height: 56px;\r\n  transition: border-color 0.15s;\r\n  font: var(--md-sys-typescale-body-medium);\r\n}\r\n.kf-textarea:focus {\r\n  border-color: rgba(167, 139, 250, 0.5);\r\n}\r\n\r\n/* -----------------------------------------------------------------------\r\n * Action row\r\n * ----------------------------------------------------------------------- */\r\n.kf-actions {\r\n  display: flex;\r\n  gap: 8px;\r\n  align-items: center;\r\n  margin-top: 4px;\r\n}\r\n\r\n.kf-mic {\r\n  background: var(--md-sys-color-surface-variant);\r\n  border: 1px solid rgba(255, 255, 255, 0.08);\r\n  border-radius: var(--md-sys-shape-corner-medium);\r\n  color: var(--md-sys-color-on-surface-variant);\r\n  font-size: 16px;\r\n  padding: 5px 9px;\r\n  cursor: pointer;\r\n  transition: color 0.15s, background 0.15s, border-color 0.15s;\r\n  line-height: 1;\r\n}\r\n.kf-mic:hover {\r\n  color: var(--md-sys-color-on-surface);\r\n  background: var(--md-sys-color-surface);\r\n}\r\n.kf-mic.active {\r\n  color: var(--md-sys-color-error);\r\n  border-color: rgba(243, 139, 168, 0.4);\r\n  background: rgba(243, 139, 168, 0.08);\r\n}\r\n\r\n.kf-save {\r\n  flex: 1;\r\n  background: var(--md-sys-color-primary);\r\n  border: none;\r\n  border-radius: var(--md-sys-shape-corner-full);\r\n  color: var(--md-sys-color-on-primary);\r\n  font: var(--md-sys-typescale-title-small);\r\n  padding: 7px 16px;\r\n  cursor: pointer;\r\n  transition: opacity 0.15s, transform 0.1s;\r\n}\r\n.kf-save:hover {\r\n  opacity: 0.88;\r\n}\r\n.kf-save:active {\r\n  transform: scale(0.97);\r\n}\r\n\r\n.kf-spinner {\r\n  flex: 1;\r\n  display: none;\r\n  height: 29px; /* Matches Save button height */\r\n  border-radius: var(--md-sys-shape-corner-full);\r\n  background: rgba(255, 255, 255, 0.1);\r\n  position: relative;\r\n  overflow: hidden;\r\n}\r\n\r\n.kf-spinner::after {\r\n  content: "";\r\n  position: absolute;\r\n  top: 0; left: 0; right: 0; bottom: 0;\r\n  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);\r\n  animation: kf-shimmer 1.5s infinite;\r\n}\r\n\r\n@keyframes kf-shimmer {\r\n  0% { transform: translateX(-100%); }\r\n  100% { transform: translateX(100%); }\r\n}\r\n\r\n/* -----------------------------------------------------------------------\r\n * Toasts (Success / Error / Info)\r\n * ----------------------------------------------------------------------- */\r\n.kf-toast {\r\n  margin-top: 12px;\r\n  padding: 10px 12px;\r\n  border-radius: var(--md-sys-shape-corner-medium);\r\n  font: var(--md-sys-typescale-body-medium);\r\n  animation: kf-slide-in 0.2s ease-out;\r\n}\r\n\r\n.kf-toast-success {\r\n  background: rgba(46, 160, 67, 0.15);\r\n  border: 1px solid rgba(46, 160, 67, 0.4);\r\n  color: #7ee787;\r\n}\r\n\r\n.kf-toast-error {\r\n  background: rgba(243, 139, 168, 0.15);\r\n  border: 1px solid rgba(243, 139, 168, 0.4);\r\n  color: var(--md-sys-color-error);\r\n}\r\n\r\n.kf-toast-info {\r\n  background: rgba(137, 180, 250, 0.15);\r\n  border: 1px solid rgba(137, 180, 250, 0.4);\r\n  color: #89b4fa;\r\n}\r\n\r\n.kf-toast-title {\r\n  font: var(--md-sys-typescale-title-small);\r\n  margin-bottom: 4px;\r\n}\r\n\r\n.kf-toast-desc {\r\n  color: var(--md-sys-color-on-background);\r\n  line-height: 1.4;\r\n}\r\n\r\n';

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

    <div class="kf-field">
      <label class="kf-label" for="kf-comment">Comment</label>
      <textarea
        id="kf-comment"
        class="kf-textarea"
        data-testid="comment-input"
        placeholder="Optional note about this clip\u2026"
      ></textarea>
    </div>

    <div class="kf-actions">
      <button class="kf-mic" id="kf-mic-btn" aria-label="Voice comment" title="Transcribe voice to comment">
        <img src="${chrome.runtime.getURL("assets/mic-16.png")}" alt="Mic" style="width: 16px; height: 16px; pointer-events: none; display: block;" />
      </button>
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
          const queuedData = await response.json().catch(() => null);
          if (queuedData?.retryAfter) {
            chrome.storage.local.set({ retryAfter: queuedData.retryAfter });
          }
          document.dispatchEvent(new CustomEvent("kf:clip-queued"));
          const poll = setInterval(async () => {
            try {
              const statusRes = await fetch(`http://127.0.0.1:${settings.port}/status`, {
                headers: { Authorization: `Bearer ${settings.token}` }
              });
              const statusData = await statusRes.json();
              if (statusData.queuedClips === 0) {
                clearInterval(poll);
                chrome.storage.local.remove("retryAfter");
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
