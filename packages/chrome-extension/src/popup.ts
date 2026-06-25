// packages/chrome-extension/src/popup.ts
// KnowledgeFlow — Action Popup Entry Point
//
// User Stories 11–12:
//   11. Fetch and display the 10 most recent clips via GET /clips.
//   12. Show "Obsidian Offline" state when the localhost server is unreachable.
//
// TODO: Implement full UI rendering once shared types and HTTP client are wired.

import type { ClipsResponse, ClipLogEntry, StatusResponse } from '@knowledgeflow/shared';

/** Read port from chrome.storage.sync. */
async function getPort(): Promise<number> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ port: 37321 }, (items) => resolve(items.port as number));
  });
}

/** Read auth token from chrome.storage.sync. */
async function getToken(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ token: '' }, (items) => resolve(items.token as string));
  });
}

/** Fetch the last 10 clips from the Obsidian plugin. */
async function fetchClips(port: number, token: string): Promise<ClipLogEntry[]> {
  const response = await fetch(`http://127.0.0.1:${port}/clips`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data: ClipsResponse = await response.json();
  return data.clips;
}

/** Render the clip list into #app. */
function renderClips(clips: ClipLogEntry[]): void {
  const app = document.getElementById('app')!;
  if (clips.length === 0) {
    app.innerHTML = '<p class="empty">No clips yet. Highlight text and press Ctrl+Shift+S to get started.</p>';
    return;
  }
  app.innerHTML = clips
    .map(
      (clip) => `
      <div class="clip-row">
        <span class="clip-title">${clip.pageTitle}</span>
        <span class="clip-path">${clip.matchedPath}</span>
        <span class="clip-time">${new Date(clip.timestamp).toLocaleString()}</span>
      </div>`,
    )
    .join('');
}

/** Render an offline / error state into #app. */
function renderOffline(message: string): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div class="offline-state">
      <span class="offline-icon">⛔</span>
      <p class="offline-title">Obsidian Offline</p>
      <p class="offline-message">${message}</p>
      <p class="offline-hint">Ensure Obsidian is open and the KnowledgeFlow plugin is enabled.</p>
    </div>`;
}

async function init(): Promise<void> {
  const [port, token] = await Promise.all([getPort(), getToken()]);
  try {
    const clips = await fetchClips(port, token);
    renderClips(clips);
  } catch {
    renderOffline(`Cannot reach localhost:${port}`);
  }
}

document.addEventListener('DOMContentLoaded', init);
