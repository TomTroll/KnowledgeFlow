// tests/e2e/clip-popup.spec.ts
//
// Playwright E2E tests for Issue #8: keyboard shortcut → Shadow DOM popup
//
// Approach:
// Rather than relying on the extension content script being injected into
// file:// URLs (which has Chrome permission quirks), we inject the compiled
// content.js directly into each test page via page.addInitScript(). This
// tests the *exact same bundled code* that runs in production — including
// the showClipPopup implementation and all 5 behaviors — through the same
// public interface (window.__kfTrigger + DOM events).
//
// The background SW / chrome.commands wiring is tested manually (see walkthrough).

import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';
import { test, expect } from './fixtures.js';
import { readFile } from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(__dirname, '..', 'fixtures', 'fixture.html');
const FIXTURE_URL = `file://${FIXTURE_PATH.replace(/\\/g, '/')}`;
const CONTENT_JS_PATH = path.resolve(__dirname, '..', '..', 'dist', 'content.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadFixtureWithContentScript(page: import('@playwright/test').Page) {
  // Stub out chrome.runtime so the content script doesn't throw
  await page.addInitScript(`
    window.chrome = window.chrome || {};
    window.chrome.runtime = window.chrome.runtime || {
      onMessage: { addListener: () => {} }
    };
  `);
  // Inject the compiled content bundle
  const contentJs = await readFile(CONTENT_JS_PATH, 'utf8');
  await page.addInitScript(contentJs);
  await page.goto(FIXTURE_URL);
}

async function selectAllText(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const el = document.getElementById('target')!;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  });
}

async function triggerClipPopup(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    (window as unknown as { __kfTrigger: () => void }).__kfTrigger();
  });
}

async function waitForPopupHost(page: import('@playwright/test').Page) {
  // The host is a zero-size wrapper div; the actual popup renders inside its Shadow DOM.
  // Use 'attached' (not 'visible') since Playwright considers the host hidden.
  return page.waitForSelector('#kf-clip-host', { state: 'attached', timeout: 2000 });
}

// ---------------------------------------------------------------------------
// Slice 1: Popup mounts within 200 ms of trigger
// ---------------------------------------------------------------------------
test('popup appears in DOM when trigger is dispatched on selected text', async ({ page }) => {
  await loadFixtureWithContentScript(page);
  await selectAllText(page);

  const before = Date.now();
  await triggerClipPopup(page);

  const host = await waitForPopupHost(page);
  const elapsed = Date.now() - before;

  expect(host).not.toBeNull();
  expect(elapsed).toBeLessThan(200);
});

// ---------------------------------------------------------------------------
// Slice 2: Popup shows first 100 characters of selected text
// ---------------------------------------------------------------------------
test('popup preview shows the first 100 characters of the selection', async ({ page }) => {
  await loadFixtureWithContentScript(page);

  const fullText: string = await page.evaluate(() =>
    document.getElementById('target')!.textContent!.trim().replace(/\s+/g, ' '),
  );
  const expectedPreview = fullText.slice(0, 100);

  await selectAllText(page);
  await triggerClipPopup(page);
  await waitForPopupHost(page);

  const previewText: string = await page.evaluate(() => {
    const host = document.getElementById('kf-clip-host');
    if (!host?.shadowRoot) return '';
    const preview = host.shadowRoot.querySelector('[data-testid="preview-text"]');
    return preview?.textContent ?? '';
  });

  expect(previewText).toBe(expectedPreview);
});

// ---------------------------------------------------------------------------
// Slice 3: Popup dismisses on Escape key
// ---------------------------------------------------------------------------
test('pressing Escape dismisses the popup', async ({ page }) => {
  await loadFixtureWithContentScript(page);
  await selectAllText(page);
  await triggerClipPopup(page);
  await waitForPopupHost(page);

  await page.keyboard.press('Escape');

  await page.waitForSelector('#kf-clip-host', { state: 'detached', timeout: 1000 });
  const host = await page.$('#kf-clip-host');
  expect(host).toBeNull();
});

// ---------------------------------------------------------------------------
// Slice 4: Popup dismisses on click outside
// ---------------------------------------------------------------------------
test('clicking outside the popup dismisses it', async ({ page }) => {
  await loadFixtureWithContentScript(page);
  await selectAllText(page);
  await triggerClipPopup(page);
  await waitForPopupHost(page);

  // Click a point guaranteed to be outside the popup panel (bottom-right fixed)
  await page.mouse.click(10, 10);

  await page.waitForSelector('#kf-clip-host', { state: 'detached', timeout: 1000 });
  const host = await page.$('#kf-clip-host');
  expect(host).toBeNull();
});

// ---------------------------------------------------------------------------
// Slice 5: Payload shape — selectedText, sourceUrl, tags are correct
// ---------------------------------------------------------------------------
test('Save button constructs correct payload: selectedText, sourceUrl, tags', async ({ page }) => {
  await loadFixtureWithContentScript(page);

  const fullText: string = await page.evaluate(() =>
    document.getElementById('target')!.textContent!.trim().replace(/\s+/g, ' '),
  );

  await selectAllText(page);
  await triggerClipPopup(page);
  await waitForPopupHost(page);

  // Set tag input value inside Shadow DOM
  await page.evaluate(() => {
    const host = document.getElementById('kf-clip-host');
    const input = host?.shadowRoot?.querySelector<HTMLInputElement>('[data-testid="tag-input"]');
    if (input) {
      input.value = 'test-tag';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // Listen for the kf:clip-save event that Save dispatches
  const payloadPromise = page.evaluate(
    () =>
      new Promise<{ selectedText: string; sourceUrl: string; tags: string[] }>((resolve) => {
        document.addEventListener('kf:clip-save', (e) => resolve((e as CustomEvent).detail), {
          once: true,
        });
      }),
  );

  // Click Save
  await page.evaluate(() => {
    const host = document.getElementById('kf-clip-host');
    const saveBtn = host?.shadowRoot?.querySelector<HTMLButtonElement>(
      '[data-testid="save-button"]',
    );
    saveBtn?.click();
  });

  const payload = await payloadPromise;

  expect(payload.selectedText).toBe(fullText);
  expect(payload.sourceUrl).toContain('fixture.html');
  expect(Array.isArray(payload.tags)).toBe(true);
  expect(payload.tags).toContain('test-tag');
});
