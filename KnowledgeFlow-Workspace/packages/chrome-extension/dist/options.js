"use strict";
(() => {
  // src/options.ts
  var DEFAULT_PORT = 37321;
  async function saveSettings(port, token) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ port, token }, resolve);
    });
  }
  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        { port: DEFAULT_PORT, token: "" },
        (items) => resolve({ port: items.port, token: items.token })
      );
    });
  }
  async function testConnection(port, token) {
    const response = await fetch(`http://127.0.0.1:${port}/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  function renderOptions(port, token) {
    const app = document.getElementById("app");
    app.innerHTML = `
    <h1>KnowledgeFlow Settings</h1>

    <section class="field">
      <label for="port">Plugin Port</label>
      <input id="port" type="number" value="${port}" min="1024" max="65535" />
      <p class="hint">Default: ${DEFAULT_PORT}. Must match the port configured in the Obsidian plugin.</p>
    </section>

    <section class="field">
      <label for="token">Authorization Token</label>
      <input id="token" type="password" value="${token}" placeholder="Paste token from Obsidian plugin settings" />
      <p class="hint">Generated in the KnowledgeFlow Obsidian plugin settings. Paste it here once.</p>
    </section>

    <div class="actions">
      <button id="save-btn">Save Settings</button>
      <button id="test-btn">Test Connection</button>
    </div>

    <div id="status-message" class="status-message" role="status" aria-live="polite"></div>
  `;
    document.getElementById("save-btn").addEventListener("click", async () => {
      const newPort = parseInt(document.getElementById("port").value, 10);
      const newToken = document.getElementById("token").value.trim();
      await saveSettings(newPort, newToken);
      showStatus("\u2705 Settings saved.", "success");
    });
    document.getElementById("test-btn").addEventListener("click", async () => {
      const currentPort = parseInt(document.getElementById("port").value, 10);
      const currentToken = document.getElementById("token").value.trim();
      showStatus("\u23F3 Testing connection\u2026", "info");
      try {
        const status = await testConnection(currentPort, currentToken);
        showStatus(
          `\u2705 Connected \u2014 Plugin v${status.pluginVersion}, ${status.cachedNoteCount} notes indexed.`,
          "success"
        );
      } catch (err) {
        showStatus(`\u26D4 Connection failed: ${err.message}`, "error");
      }
    });
  }
  function showStatus(message, type) {
    const el = document.getElementById("status-message");
    el.textContent = message;
    el.className = `status-message status-${type}`;
  }
  async function init() {
    const { port, token } = await loadSettings();
    renderOptions(port, token);
  }
  document.addEventListener("DOMContentLoaded", init);
})();
//# sourceMappingURL=options.js.map
