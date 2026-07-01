"use strict";
(() => {
  // src/popup.ts
  async function getPort() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ port: 37321 }, (items) => resolve(items.port));
    });
  }
  async function getToken() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ token: "" }, (items) => resolve(items.token));
    });
  }
  async function fetchClips(port, token) {
    const response = await fetch(`http://127.0.0.1:${port}/clips`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.clips;
  }
  function renderClips(clips) {
    const app = document.getElementById("app");
    if (clips.length === 0) {
      app.innerHTML = '<p class="empty">No clips yet. Highlight text and press Ctrl+Shift+S to get started.</p>';
      return;
    }
    app.innerHTML = clips.map(
      (clip) => {
        const previewText = clip.selectedText.length > 80 ? clip.selectedText.substring(0, 80) + "..." : clip.selectedText;
        return `
      <div class="clip-row">
        <span class="clip-preview">${previewText}</span>
        <span class="clip-path">${clip.matchedPath}</span>
        <span class="clip-time">${new Date(clip.timestamp).toLocaleString()}</span>
      </div>`;
      }
    ).join("");
  }
  function renderOffline(message, onRetry) {
    const app = document.getElementById("app");
    app.innerHTML = `
    <div class="offline-state" style="text-align: center; padding: 24px 12px;">
      <span class="offline-icon" style="font-size: 24px;">\u26D4</span>
      <p class="offline-title" style="font: var(--md-sys-typescale-title-small); margin-top: 12px; color: var(--md-sys-color-on-background);">Obsidian Offline</p>
      <p class="offline-message" style="margin-top: 4px; color: var(--md-sys-color-error); font: var(--md-sys-typescale-body-medium);">${message}</p>
      <p class="offline-hint" style="margin-top: 12px; font: var(--md-sys-typescale-label-small); color: var(--md-sys-color-on-surface-variant);">Ensure Obsidian is open and the KnowledgeFlow plugin is enabled.</p>
      <button id="retry-btn" style="margin-top: 20px; padding: 8px 16px; cursor: pointer; border-radius: var(--md-sys-shape-corner-full); border: none; background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); font: var(--md-sys-typescale-label-small); transition: opacity 0.2s;">Retry</button>
    </div>`;
    document.getElementById("retry-btn")?.addEventListener("click", onRetry);
  }
  async function fetchStatus(port, token) {
    const response = await fetch(`http://127.0.0.1:${port}/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  var statusPollTimer = null;
  var countdownTimer = null;
  function renderBanner(retryAfter) {
    let banner = document.getElementById("queue-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "queue-banner";
      banner.style.padding = "12px 16px";
      banner.style.background = "var(--md-sys-color-error)";
      banner.style.color = "var(--md-sys-color-on-error)";
      banner.style.font = "var(--md-sys-typescale-title-small)";
      banner.style.marginBottom = "12px";
      banner.style.borderRadius = "var(--md-sys-shape-corner-medium)";
      banner.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
      document.body.insertBefore(banner, document.getElementById("app"));
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((retryAfter - Date.now()) / 1e3));
      if (banner) {
        banner.textContent = `\u23F3 Clip queued \u2014 retrying in ${remaining}s...`;
      }
    };
    update();
    if (!countdownTimer) {
      countdownTimer = setInterval(update, 1e3);
    }
  }
  function removeBanner() {
    const banner = document.getElementById("queue-banner");
    if (banner) banner.remove();
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }
  async function init() {
    const [port, token] = await Promise.all([getPort(), getToken()]);
    const pollStatusRoutine = async () => {
      try {
        const status = await fetchStatus(port, token);
        if (status.queuedClips > 0) {
          chrome.storage.local.get("retryAfter", (items) => {
            if (items.retryAfter) {
              renderBanner(items.retryAfter);
            }
          });
        } else {
          const wasShowingBanner = !!document.getElementById("queue-banner");
          removeBanner();
          if (wasShowingBanner) {
            loadClips();
          }
        }
      } catch (e) {
        removeBanner();
        if (statusPollTimer) {
          clearInterval(statusPollTimer);
          statusPollTimer = null;
        }
        renderOffline(`Cannot reach localhost:${port}`, handleRetry);
      }
    };
    const loadClips = async () => {
      try {
        const clips = await fetchClips(port, token);
        renderClips(clips);
        return true;
      } catch {
        removeBanner();
        renderOffline(`Cannot reach localhost:${port}`, handleRetry);
        return false;
      }
    };
    const handleRetry = async () => {
      const isOnline2 = await loadClips();
      if (isOnline2 && !statusPollTimer) {
        pollStatusRoutine();
        statusPollTimer = setInterval(pollStatusRoutine, 2e3);
      }
    };
    const isOnline = await loadClips();
    if (isOnline) {
      pollStatusRoutine();
      statusPollTimer = setInterval(pollStatusRoutine, 2e3);
    }
  }
  document.addEventListener("DOMContentLoaded", init);
})();
//# sourceMappingURL=popup.js.map
