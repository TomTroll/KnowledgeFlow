// tests/e2e/fixtures.ts
// Shared Playwright fixture that boots a Chromium browser with the
// KnowledgeFlow extension loaded from the local dist folder.

import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built extension lives two levels up from tests/e2e/
const EXTENSION_PATH = path.resolve(__dirname, '..', '..');

export type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
  page: Page;
};

/**
 * Custom test fixture that starts a persistent Chromium context with the
 * extension loaded. Extensions cannot run in incognito contexts.
 *
 * --allow-file-access-from-files is required so content scripts can inject
 * into file:// URLs (Chrome's content script matching for <all_urls> does
 * not cover file:// without this flag).
 */
export const test = base.extend<ExtensionFixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--allow-file-access-from-files',
        '--no-sandbox',
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // Service worker registers the extension; grab its ID from sw targets
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },

  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
  },
});

export { expect } from '@playwright/test';
