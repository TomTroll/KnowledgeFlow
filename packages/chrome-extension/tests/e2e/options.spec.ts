import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from './fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OPTIONS_PATH = path.resolve(__dirname, '..', '..', 'options.html');
const OPTIONS_URL = `file://${OPTIONS_PATH.replace(/\\/g, '/')}`;

test('Options page pre-populates fields and saves on change', async ({ page }) => {
  let savedData: any = {};
  await page.addInitScript(() => {
    window.chrome = window.chrome || {};
    window.chrome.storage = {
      sync: {
        get: (keys: any, cb: any) => {
          const data = { port: 12345, token: 'existing-token' };
          if (cb) cb(data); else keys(data);
        },
        set: (data: any, cb: any) => {
          window.__mockSavedData = data;
          if (cb) cb();
        }
      }
    };
  });

  await page.goto(OPTIONS_URL);

  // Pre-populated values
  await expect(page.locator('#port')).toHaveValue('12345');
  await expect(page.locator('#token')).toHaveValue('existing-token');

  // Change values
  await page.fill('#port', '54321');
  await page.fill('#token', 'new-token');
  
  // Trigger change event to save
  await page.locator('#port').blur();

  const saved = await page.evaluate(() => (window as any).__mockSavedData);
  expect(saved.port).toBe(54321);
  expect(saved.token).toBe('new-token');
});

test('Test Connection success', async ({ page }) => {
  await page.addInitScript(() => {
    window.chrome = window.chrome || {};
    window.chrome.storage = {
      sync: { get: (keys: any, cb: any) => { if (cb) cb({port: 37321, token: 'token'}); else keys({port: 37321, token: 'token'}); }, set: (d: any, cb: any) => { if (cb) cb(); } }
    };
  });

  await page.route('http://127.0.0.1:37321/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pluginVersion: '1.2.3', cachedNoteCount: 10 })
    });
  });

  await page.goto(OPTIONS_URL);
  await page.click('#test-btn');

  await expect(page.locator('#status-message')).toHaveText(/✅ Connected — Plugin v1\.2\.3/);
});

test('Test Connection failure - unauthorized', async ({ page }) => {
  await page.addInitScript(() => {
    window.chrome = window.chrome || {};
    window.chrome.storage = {
      sync: { get: (keys: any, cb: any) => { if (cb) cb({port: 37321, token: 'token'}); else keys({port: 37321, token: 'token'}); }, set: (d: any, cb: any) => { if (cb) cb(); } }
    };
  });

  await page.route('http://127.0.0.1:37321/status', async (route) => {
    await route.fulfill({ status: 401 });
  });

  await page.goto(OPTIONS_URL);
  await page.click('#test-btn');

  await expect(page.locator('#status-message')).toHaveText('⛔ Connection failed: Invalid authorization token.');
});

test('Test Connection failure - offline', async ({ page }) => {
  await page.addInitScript(() => {
    window.chrome = window.chrome || {};
    window.chrome.storage = {
      sync: { get: (keys: any, cb: any) => { if (cb) cb({port: 37321, token: 'token'}); else keys({port: 37321, token: 'token'}); }, set: (d: any, cb: any) => { if (cb) cb(); } }
    };
  });

  await page.route('http://127.0.0.1:37321/status', async (route) => {
    await route.abort('failed');
  });

  await page.goto(OPTIONS_URL);
  await page.click('#test-btn');

  await expect(page.locator('#status-message')).toHaveText('⛔ Connection failed: The Obsidian server is unreachable. Check that Obsidian is open and the port is correct.');
});
