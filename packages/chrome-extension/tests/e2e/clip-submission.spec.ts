// tests/e2e/clip-submission.spec.ts
//
// Playwright E2E tests for Issue #9: clip submission and feedback

import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from './fixtures.js';
import { readFile } from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(__dirname, '..', 'fixtures', 'fixture.html');
const FIXTURE_URL = `file://${FIXTURE_PATH.replace(/\\/g, '/')}`;
const CONTENT_JS_PATH = path.resolve(__dirname, '..', '..', 'dist', 'content.js');

async function loadFixtureWithContentScript(page: import('@playwright/test').Page) {
  // Mock chrome storage to provide a default port and token
  await page.addInitScript(`
    window.chrome = window.chrome || {};
    window.chrome.runtime = window.chrome.runtime || {
      onMessage: { addListener: () => {} }
    };
    window.chrome.storage = {
      sync: {
        get: function(keys, cb) {
          console.log('MOCK CHROME STORAGE CALLED', keys);
          if (typeof cb === 'function') {
            cb({ port: 37321, token: 'test-token' });
          } else if (typeof keys === 'function') {
            keys({ port: 37321, token: 'test-token' });
          }
        }
      }
    };
  `);
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

test('Clicking Save sends a POST /clip request with correct payload', async ({ page }) => {
  await loadFixtureWithContentScript(page);
  
  const fullText = await page.evaluate(() =>
    document.getElementById('target')!.textContent!.trim().replace(/\s+/g, ' '),
  );

  let capturedRequest: import('@playwright/test').Request | null = null;
  let capturedBody: any = null;

  // Mock the Obsidian plugin server
  await page.route('http://127.0.0.1:37321/clip', async (route, request) => {
    capturedRequest = request;
    capturedBody = request.postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        clipId: '123',
        matchedPath: 'Inbox/Test Note.md',
        justification: 'Matches test'
      })
    });
  });

  await selectAllText(page);
  await triggerClipPopup(page);
  await page.waitForSelector('#kf-clip-host', { state: 'attached' });

  // Add a tag and comment
  await page.evaluate(() => {
    const host = document.getElementById('kf-clip-host');
    const input = host?.shadowRoot?.querySelector<HTMLInputElement>('[data-testid="tag-input"]');
    if (input) {
      input.value = 'e2e-tag';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const comment = host?.shadowRoot?.querySelector<HTMLTextAreaElement>('[data-testid="comment-input"]');
    if (comment) {
      comment.value = 'e2e comment';
      comment.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // Click Save
  await page.evaluate(() => {
    const host = document.getElementById('kf-clip-host');
    const saveBtn = host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-testid="save-button"]');
    saveBtn?.click();
  });

  // Wait for the request to be intercepted
  await page.waitForResponse('http://127.0.0.1:37321/clip');

  expect(capturedRequest).not.toBeNull();
  expect(capturedRequest!.method()).toBe('POST');
  expect(capturedRequest!.headers()['authorization']).toContain('Bearer');
  
  expect(capturedBody).not.toBeNull();
  expect(capturedBody.selectedText).toBe(fullText);
  expect(capturedBody.sourceUrl).toContain('fixture.html');
  expect(capturedBody.tags).toEqual(['e2e-tag']);
  expect(capturedBody.comment).toBe('e2e comment');
});

test('Clicking Save replaces the save button with a loading spinner', async ({ page }) => {
  await loadFixtureWithContentScript(page);
  
  // Mock the API with a slow response so we can check the loading state
  await page.route('http://127.0.0.1:37321/clip', async (route) => {
    // Delay for 500ms
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ status: 200, body: '{}' });
  });

  await selectAllText(page);
  await triggerClipPopup(page);
  await page.waitForSelector('#kf-clip-host', { state: 'attached' });

  // Click Save
  await page.evaluate(() => {
    const host = document.getElementById('kf-clip-host');
    const saveBtn = host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-testid="save-button"]');
    saveBtn?.click();
  });

  // Check that the save button is disabled or hidden and the spinner is visible
  const hasSpinner = await page.evaluate(() => {
    const host = document.getElementById('kf-clip-host');
    const spinner = host?.shadowRoot?.querySelector('[data-testid="loading-spinner"]');
    return !!spinner;
  });

  const saveBtnVisible = await page.evaluate(() => {
    const host = document.getElementById('kf-clip-host');
    const saveBtn = host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-testid="save-button"]');
    return saveBtn && saveBtn.style.display !== 'none';
  });

  expect(hasSpinner).toBe(true);
  expect(saveBtnVisible).toBe(false);
});

test('Successful submission shows success toast and dismisses popup', async ({ page }) => {
  await loadFixtureWithContentScript(page);
  
  await page.route('http://127.0.0.1:37321/clip', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        clipId: '123',
        matchedPath: 'Inbox/Test Note.md',
        justification: 'Matches test'
      })
    });
  });

  await selectAllText(page);
  await triggerClipPopup(page);
  await page.waitForSelector('#kf-clip-host', { state: 'attached' });

  // Click Save
  await page.evaluate(() => {
    const host = document.getElementById('kf-clip-host');
    const saveBtn = host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-testid="save-button"]');
    saveBtn?.click();
  });

  // Wait for the success toast
  const successToast = await page.evaluate(async () => {
    return new Promise<string>((resolve) => {
      const host = document.getElementById('kf-clip-host');
      if (!host?.shadowRoot) return resolve('');
      
      const observer = new MutationObserver(() => {
        const toast = host.shadowRoot!.querySelector('[data-testid="toast-success"]');
        if (toast && toast.textContent) {
          observer.disconnect();
          resolve(toast.textContent);
        }
      });
      observer.observe(host.shadowRoot, { childList: true, subtree: true });
    });
  });

  expect(successToast).toContain('Inbox/Test Note.md');
  expect(successToast).toContain('Matches test');

  // Popup should be dismissed after a short delay
  await page.waitForSelector('#kf-clip-host', { state: 'detached', timeout: 3000 });
  const host = await page.$('#kf-clip-host');
  expect(host).toBeNull();
});

test('Failed submission shows error toast and restores Save button', async ({ page }) => {
  await loadFixtureWithContentScript(page);
  
  await page.route('http://127.0.0.1:37321/clip', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Failed to connect to Obsidian' })
    });
  });

  await selectAllText(page);
  await triggerClipPopup(page);
  await page.waitForSelector('#kf-clip-host', { state: 'attached' });

  // Click Save
  await page.evaluate(() => {
    const host = document.getElementById('kf-clip-host');
    const saveBtn = host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-testid="save-button"]');
    saveBtn?.click();
  });

  // Wait for the error toast
  const errorToast = await page.evaluate(async () => {
    return new Promise<string>((resolve) => {
      const host = document.getElementById('kf-clip-host');
      if (!host?.shadowRoot) return resolve('');
      
      const observer = new MutationObserver(() => {
        const toast = host.shadowRoot!.querySelector('[data-testid="toast-error"]');
        if (toast && toast.textContent) {
          observer.disconnect();
          resolve(toast.textContent);
        }
      });
      observer.observe(host.shadowRoot, { childList: true, subtree: true });
    });
  });

  expect(errorToast).toContain('Failed to connect to Obsidian');

  // Verify spinner is gone and save button is back
  const spinnerVisible = await page.evaluate(() => {
    const host = document.getElementById('kf-clip-host');
    const spinner = host?.shadowRoot?.querySelector<HTMLElement>('[data-testid="loading-spinner"]');
    return spinner && spinner.style.display !== 'none';
  });

  const saveBtnVisible = await page.evaluate(() => {
    const host = document.getElementById('kf-clip-host');
    const saveBtn = host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-testid="save-button"]');
    return saveBtn && saveBtn.style.display !== 'none';
  });

  expect(spinnerVisible).toBe(false);
  expect(saveBtnVisible).toBe(true);
});

test('202 Accepted triggers polling until queuedClips is 0', async ({ page }) => {
  await loadFixtureWithContentScript(page);
  
  let clipReqCount = 0;
  let statusReqCount = 0;

  await page.route('http://127.0.0.1:37321/clip', async (route) => {
    clipReqCount++;
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, clipId: '123' })
    });
  });

  await page.route('http://127.0.0.1:37321/status', async (route) => {
    statusReqCount++;
    // First poll returns 1 queued, second poll returns 0
    const queuedClips = statusReqCount === 1 ? 1 : 0;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ queuedClips })
    });
  });

  // Mock a second clip endpoint to simulate getting the clip info if needed
  // Actually, the issue says "resolves and shows the success toast". 
  // It probably just assumes success when queue is 0, since we don't have a way to fetch clip result.
  // Wait, does the API return the clip result when we poll?
  // No, `GET /status` only returns `queuedClips`. We just show a generic success toast.
  await page.route('http://127.0.0.1:37321/clips', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ clips: [{ clipId: '123', matchedPath: 'Delayed Note.md', justification: 'Processed' }] })
    });
  });

  await selectAllText(page);
  await triggerClipPopup(page);
  await page.waitForSelector('#kf-clip-host', { state: 'attached' });

  // Click Save
  await page.evaluate(() => {
    const host = document.getElementById('kf-clip-host');
    const saveBtn = host?.shadowRoot?.querySelector<HTMLButtonElement>('[data-testid="save-button"]');
    saveBtn?.click();
  });

  // Wait for the queued toast
  const queuedToast = await page.evaluate(async () => {
    return new Promise<string>((resolve) => {
      const host = document.getElementById('kf-clip-host');
      if (!host?.shadowRoot) return resolve('');
      
      const observer = new MutationObserver(() => {
        const toast = host.shadowRoot!.querySelector('[data-testid="toast-queued"]');
        if (toast && toast.textContent) {
          observer.disconnect();
          resolve(toast.textContent);
        }
      });
      observer.observe(host.shadowRoot, { childList: true, subtree: true });
    });
  });

  expect(queuedToast).toContain('Rate limit reached');

  // Wait for success toast
  const successToast = await page.evaluate(async () => {
    return new Promise<string>((resolve) => {
      const host = document.getElementById('kf-clip-host');
      if (!host?.shadowRoot) return resolve('');
      
      const observer = new MutationObserver(() => {
        const toast = host.shadowRoot!.querySelector('[data-testid="toast-success"]');
        if (toast && toast.textContent) {
          observer.disconnect();
          resolve(toast.textContent);
        }
      });
      observer.observe(host.shadowRoot, { childList: true, subtree: true });
    });
  });

  expect(successToast).toContain('Delayed Note.md');
});

