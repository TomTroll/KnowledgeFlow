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
      (clip) => `
      <div class="clip-row">
        <span class="clip-title">${clip.pageTitle}</span>
        <span class="clip-path">${clip.matchedPath}</span>
        <span class="clip-time">${new Date(clip.timestamp).toLocaleString()}</span>
      </div>`
    ).join("");
  }
  function renderOffline(message) {
    const app = document.getElementById("app");
    app.innerHTML = `
    <div class="offline-state">
      <span class="offline-icon">\u26D4</span>
      <p class="offline-title">Obsidian Offline</p>
      <p class="offline-message">${message}</p>
      <p class="offline-hint">Ensure Obsidian is open and the KnowledgeFlow plugin is enabled.</p>
    </div>`;
  }
  async function init() {
    const [port, token] = await Promise.all([getPort(), getToken()]);
    try {
      const clips = await fetchClips(port, token);
      renderClips(clips);
    } catch {
      renderOffline(`Cannot reach localhost:${port}`);
    }
  }
  document.addEventListener("DOMContentLoaded", init);
})();
//# sourceMappingURL=popup.js.map
