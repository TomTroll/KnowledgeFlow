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
      (clip) => {
        const previewText = clip.selectedText.length > 80 ? clip.selectedText.substring(0, 80) + '...' : clip.selectedText;
        return `
      <div class="clip-row">
        <span class="clip-preview">${previewText}</span>
        <span class="clip-path">${clip.matchedPath}</span>
        <span class="clip-time">${new Date(clip.timestamp).toLocaleString()}</span>
      </div>`;
      }
    )
    .join('');
}

/** Render an offline / error state into #app. */
function renderOffline(message: string, onRetry: () => void): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div class="offline-state" style="text-align: center; padding: 24px 12px;">
      <span class="offline-icon" style="font-size: 24px;">⛔</span>
      <p class="offline-title" style="font: var(--md-sys-typescale-title-small); margin-top: 12px; color: var(--md-sys-color-on-background);">Obsidian Offline</p>
      <p class="offline-message" style="margin-top: 4px; color: var(--md-sys-color-error); font: var(--md-sys-typescale-body-medium);">${message}</p>
      <p class="offline-hint" style="margin-top: 12px; font: var(--md-sys-typescale-label-small); color: var(--md-sys-color-on-surface-variant);">Ensure Obsidian is open and the KnowledgeFlow plugin is enabled.</p>
      <button id="retry-btn" style="margin-top: 20px; padding: 8px 16px; cursor: pointer; border-radius: var(--md-sys-shape-corner-full); border: none; background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); font: var(--md-sys-typescale-label-small); transition: opacity 0.2s;">Retry</button>
    </div>`;
    
  document.getElementById('retry-btn')?.addEventListener('click', onRetry);
}

async function fetchStatus(port: number, token: string): Promise<StatusResponse> {
  const response = await fetch(`http://127.0.0.1:${port}/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

let statusPollTimer: ReturnType<typeof setInterval> | null = null;
let countdownTimer: ReturnType<typeof setInterval> | null = null;

function renderBanner(retryAfter: number) {
  let banner = document.getElementById('queue-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'queue-banner';
    banner.style.padding = '12px 16px';
    banner.style.background = 'var(--md-sys-color-error)';
    banner.style.color = 'var(--md-sys-color-on-error)';
    banner.style.font = 'var(--md-sys-typescale-title-small)';
    banner.style.marginBottom = '12px';
    banner.style.borderRadius = 'var(--md-sys-shape-corner-medium)';
    banner.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    document.body.insertBefore(banner, document.getElementById('app'));
  }

  const update = () => {
    const remaining = Math.max(0, Math.ceil((retryAfter - Date.now()) / 1000));
    if (banner) {
      banner.textContent = `⏳ Clip queued — retrying in ${remaining}s...`;
    }
  };
  update();

  if (!countdownTimer) {
    countdownTimer = setInterval(update, 1000);
  }
}

function removeBanner() {
  const banner = document.getElementById('queue-banner');
  if (banner) banner.remove();
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

async function init(): Promise<void> {
  const [port, token] = await Promise.all([getPort(), getToken()]);
  
  const pollStatusRoutine = async () => {
    try {
      const status = await fetchStatus(port, token);
      if (status.queuedClips > 0) {
        chrome.storage.local.get('retryAfter', (items) => {
          if (items.retryAfter) {
            renderBanner(items.retryAfter);
          }
        });
      } else {
        const wasShowingBanner = !!document.getElementById('queue-banner');
        removeBanner();
        
        // If queue just resolved, fetch latest clips to show the newly inserted one
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
      return true; // Success
    } catch {
      removeBanner(); // Ensure banner is hidden when offline
      renderOffline(`Cannot reach localhost:${port}`, handleRetry);
      return false; // Offline
    }
  };

  const handleRetry = async () => {
    const isOnline = await loadClips();
    if (isOnline && !statusPollTimer) {
      pollStatusRoutine();
      statusPollTimer = setInterval(pollStatusRoutine, 2000);
    }
  };

  const isOnline = await loadClips();
  if (isOnline) {
    pollStatusRoutine();
    statusPollTimer = setInterval(pollStatusRoutine, 2000);
  }
}

document.addEventListener('DOMContentLoaded', init);
