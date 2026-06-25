// packages/chrome-extension/src/options.ts
// KnowledgeFlow — Options Page Entry Point
//
// User Stories 13–14:
//   13. Configure the localhost port and paste the local authorization token.
//   14. "Test Connection" button validates live communication with the plugin.
//
// TODO: Implement full options UI once core HTTP client is established.

import type { StatusResponse } from '@knowledgeflow/shared';

const DEFAULT_PORT = 37321;

/** Persist settings to chrome.storage.sync. */
async function saveSettings(port: number, token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ port, token }, resolve);
  });
}

/** Load settings from chrome.storage.sync. */
async function loadSettings(): Promise<{ port: number; token: string }> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ port: DEFAULT_PORT, token: '' }, (items) =>
      resolve({ port: items.port as number, token: items.token as string }),
    );
  });
}

/**
 * Test the connection to the Obsidian plugin by hitting GET /status.
 * Returns the status response on success, throws on failure.
 */
async function testConnection(port: number, token: string): Promise<StatusResponse> {
  const response = await fetch(`http://127.0.0.1:${port}/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<StatusResponse>;
}

/** Render the options UI into #app. */
function renderOptions(port: number, token: string): void {
  const app = document.getElementById('app')!;
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

  document.getElementById('save-btn')!.addEventListener('click', async () => {
    const newPort = parseInt((document.getElementById('port') as HTMLInputElement).value, 10);
    const newToken = (document.getElementById('token') as HTMLInputElement).value.trim();
    await saveSettings(newPort, newToken);
    showStatus('✅ Settings saved.', 'success');
  });

  document.getElementById('test-btn')!.addEventListener('click', async () => {
    const currentPort = parseInt((document.getElementById('port') as HTMLInputElement).value, 10);
    const currentToken = (document.getElementById('token') as HTMLInputElement).value.trim();
    showStatus('⏳ Testing connection…', 'info');
    try {
      const status = await testConnection(currentPort, currentToken);
      showStatus(
        `✅ Connected — Plugin v${status.pluginVersion}, ${status.cachedNoteCount} notes indexed.`,
        'success',
      );
    } catch (err) {
      showStatus(`⛔ Connection failed: ${(err as Error).message}`, 'error');
    }
  });
}

function showStatus(message: string, type: 'success' | 'error' | 'info'): void {
  const el = document.getElementById('status-message')!;
  el.textContent = message;
  el.className = `status-message status-${type}`;
}

async function init(): Promise<void> {
  const { port, token } = await loadSettings();
  renderOptions(port, token);
}

document.addEventListener('DOMContentLoaded', init);
