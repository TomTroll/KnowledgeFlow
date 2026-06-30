import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from './fixtures.js';
import { readFile } from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POPUP_PATH = path.resolve(__dirname, '..', '..', 'popup.html');
const POPUP_URL = `file://${POPUP_PATH.replace(/\\/g, '/')}`;

test('Action popup shows countdown banner when queuedClips > 0', async ({ page }) => {
  // Mock chrome storage
  await page.addInitScript(`
    window.chrome = window.chrome || {};
    window.chrome.storage = {
      sync: {
        get: function(keys, cb) {
          if (typeof cb === 'function') cb({ port: 37321, token: 'test-token' });
          else if (typeof keys === 'function') keys({ port: 37321, token: 'test-token' });
        }
      },
      local: {
        get: function(keys, cb) {
          // Set retryAfter to 10 seconds from now
          const mockData = { retryAfter: Date.now() + 10000 };
          if (typeof cb === 'function') cb(mockData);
          else if (typeof keys === 'function') keys(mockData);
        }
      }
    };
  `);

  // Mock Obsidian API
  await page.route('http://127.0.0.1:37321/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ queuedClips: 1 })
    });
  });

  await page.route('http://127.0.0.1:37321/clips', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ clips: [] })
    });
  });

  await page.goto(POPUP_URL);

  // Wait for the banner
  const banner = page.locator('#queue-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Clip queued — retrying in');
});

test('Banner disappears when queuedClips becomes 0', async ({ page }) => {
  await page.addInitScript(`
    window.chrome = window.chrome || {};
    window.chrome.storage = {
      sync: {
        get: function(keys, cb) {
          if (typeof cb === 'function') cb({ port: 37321, token: 'test-token' });
          else if (typeof keys === 'function') keys({ port: 37321, token: 'test-token' });
        }
      },
      local: {
        get: function(keys, cb) {
          const mockData = { retryAfter: Date.now() + 10000 };
          if (typeof cb === 'function') cb(mockData);
          else if (typeof keys === 'function') keys(mockData);
        }
      }
    };
  `);

  let pollCount = 0;
  await page.route('http://127.0.0.1:37321/status', async (route) => {
    pollCount++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ queuedClips: pollCount === 1 ? 1 : 0 })
    });
  });

  await page.route('http://127.0.0.1:37321/clips', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ clips: [] })
    });
  });

  await page.goto(POPUP_URL);

  const banner = page.locator('#queue-banner');
  // Should be visible initially
  await expect(banner).toBeVisible();

  // Then wait for it to disappear
  await expect(banner).not.toBeVisible({ timeout: 5000 });
});

test('Displays recent clips on open', async ({ page }) => {
  await page.addInitScript(`
    window.chrome = window.chrome || {};
    window.chrome.storage = {
      sync: { get: (keys, cb) => { if(cb) cb({port: 37321, token: 'test'}); else keys({port: 37321, token: 'test'}); } },
      local: { get: (keys, cb) => { if(cb) cb({}); else keys({}); } }
    };
  `);

  await page.route('http://127.0.0.1:37321/status', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ queuedClips: 0 }) });
  });

  await page.route('http://127.0.0.1:37321/clips', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        clips: [{
          id: 'clip-1',
          sourceUrl: 'https://example.com',
          pageTitle: 'Example',
          selectedText: 'A very long text that exceeds 80 characters so we can test if it truncates correctly at the 80 character mark properly. Yes it should.',
          timestamp: '2026-06-30T10:00:00.000Z',
          matchedPath: 'Notes/Example.md',
          justification: null,
          tags: [],
          comment: '',
          status: 'inserted'
        }]
      })
    });
  });

  await page.goto(POPUP_URL);

  const row = page.locator('.clip-row').first();
  await expect(row).toBeVisible();
  await expect(row.locator('.clip-path')).toHaveText('Notes/Example.md');
  await expect(row.locator('.clip-preview')).toContainText('A very long text that exceeds 80 characters so we can test if it truncates corre...');
});

test('Displays Offline state and retry button when server unreachable', async ({ page }) => {
  await page.addInitScript(`
    window.chrome = window.chrome || {};
    window.chrome.storage = {
      sync: { get: (keys, cb) => { if(cb) cb({port: 37321, token: 'test'}); else keys({port: 37321, token: 'test'}); } },
      local: { get: (keys, cb) => { if(cb) cb({}); else keys({}); } }
    };
  `);

  // Simulate network failure
  await page.route('http://127.0.0.1:37321/clips', async (route) => {
    await route.abort('failed');
  });

  await page.goto(POPUP_URL);

  const offlineState = page.locator('.offline-state');
  await expect(offlineState).toBeVisible();
  
  const retryBtn = page.locator('#retry-btn');
  await expect(retryBtn).toBeVisible();
  await expect(retryBtn).toHaveText('Retry');
  
  // Now mock success for retry
  await page.route('http://127.0.0.1:37321/clips', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ clips: [] })
    });
  });
  
  await retryBtn.click();
  await expect(offlineState).not.toBeVisible();
  await expect(page.locator('.empty')).toBeVisible();
});
