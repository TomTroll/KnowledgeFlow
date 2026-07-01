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
      <div class="input-wrapper">
        <input id="token" type="password" value="${token}" placeholder="Paste token from Obsidian plugin settings" />
        <button type="button" class="toggle-password" id="toggle-token-visibility" aria-label="Toggle token visibility">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        </button>
      </div>
      <p class="hint">Generated in the KnowledgeFlow Obsidian plugin settings. Paste it here once.</p>
    </section>

    <div class="actions">
      <button id="save-btn">Save Settings</button>
      <button id="test-btn">Test Connection</button>
    </div>

    <div id="status-message" class="status-message" role="status" aria-live="polite"></div>
  `;
    const saveSettingsHandler = async () => {
      const newPort = parseInt(document.getElementById("port").value, 10);
      const newToken = document.getElementById("token").value.trim();
      if (!isNaN(newPort)) {
        await saveSettings(newPort, newToken);
      }
    };
    document.getElementById("port").addEventListener("input", saveSettingsHandler);
    document.getElementById("token").addEventListener("input", saveSettingsHandler);
    const tokenInput = document.getElementById("token");
    const toggleBtn = document.getElementById("toggle-token-visibility");
    toggleBtn.addEventListener("click", () => {
      const isPassword = tokenInput.type === "password";
      tokenInput.type = isPassword ? "text" : "password";
      toggleBtn.innerHTML = isPassword ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-off-icon"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    });
    document.getElementById("save-btn").addEventListener("click", async () => {
      await saveSettingsHandler();
      showStatus("\u2705 Settings saved.", "success");
    });
    document.getElementById("test-btn").addEventListener("click", async () => {
      const currentPort = parseInt(document.getElementById("port").value, 10);
      const currentToken = document.getElementById("token").value.trim();
      showStatus("\u23F3 Testing connection\u2026", "info");
      try {
        const status = await testConnection(currentPort, currentToken);
        showStatus(
          `\u2705 Connected \u2014 Plugin v${status.pluginVersion}`,
          "success"
        );
      } catch (err) {
        const errMsg = err.message;
        if (errMsg.includes("HTTP 401") || errMsg.includes("HTTP 403")) {
          showStatus("\u26D4 Connection failed: Invalid authorization token.", "error");
        } else if (errMsg.includes("Failed to fetch") || errMsg.includes("NetworkError") || errMsg.includes("Load failed")) {
          showStatus("\u26D4 Connection failed: The Obsidian server is unreachable. Check that Obsidian is open and the port is correct.", "error");
        } else {
          showStatus(`\u26D4 Connection failed: ${errMsg}`, "error");
        }
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
