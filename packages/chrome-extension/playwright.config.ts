// packages/chrome-extension/playwright.config.ts
//
// Extension-aware Playwright configuration.
// Extensions can only be loaded in Chromium (not WebKit/Firefox) via
// a persistent browser context — standard `page` fixtures don't work.
// The E2E tests use the `extensionContext` fixture defined in tests/e2e/fixtures.ts.

import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  // Run tests serially — only one Chromium instance with the extension at a time
  workers: 1,
  use: {
    // headless: false is required for extensions in Playwright
    headless: false,
    // The built extension dist lives at the package root
    // (esbuild writes dist/ relative to the package root)
  },
  projects: [
    {
      name: 'chrome-extension',
      use: {
        // Channel must be 'chromium' (not 'chrome') for extension loading
        channel: undefined,
      },
    },
  ],
});
