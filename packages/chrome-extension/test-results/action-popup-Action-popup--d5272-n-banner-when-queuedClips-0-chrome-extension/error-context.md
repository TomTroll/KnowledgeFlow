# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: action-popup.spec.ts >> Action popup shows countdown banner when queuedClips > 0
- Location: tests/e2e/action-popup.spec.ts:10:1

# Error details

```
Error: browserType.launchPersistentContext: Executable doesn't exist at /Users/tomtroll/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║                                                            ║
║     npx playwright install                                 ║
║                                                            ║
║ <3 Playwright Team                                         ║
╚════════════════════════════════════════════════════════════╝
```

# Test source

```ts
  1  | // tests/e2e/fixtures.ts
  2  | // Shared Playwright fixture that boots a Chromium browser with the
  3  | // KnowledgeFlow extension loaded from the local dist folder.
  4  | 
  5  | import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
  6  | import path from 'path';
  7  | import { fileURLToPath } from 'url';
  8  | 
  9  | const __dirname = path.dirname(fileURLToPath(import.meta.url));
  10 | 
  11 | // The built extension lives two levels up from tests/e2e/
  12 | const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
  13 | 
  14 | export type ExtensionFixtures = {
  15 |   context: BrowserContext;
  16 |   extensionId: string;
  17 |   page: Page;
  18 | };
  19 | 
  20 | /**
  21 |  * Custom test fixture that starts a persistent Chromium context with the
  22 |  * extension loaded. Extensions cannot run in incognito contexts.
  23 |  *
  24 |  * --allow-file-access-from-files is required so content scripts can inject
  25 |  * into file:// URLs (Chrome's content script matching for <all_urls> does
  26 |  * not cover file:// without this flag).
  27 |  */
  28 | export const test = base.extend<ExtensionFixtures>({
  29 |   // eslint-disable-next-line no-empty-pattern
  30 |   context: async ({}, use) => {
> 31 |     const context = await chromium.launchPersistentContext('', {
     |                     ^ Error: browserType.launchPersistentContext: Executable doesn't exist at /Users/tomtroll/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing
  32 |       headless: false,
  33 |       args: [
  34 |         `--disable-extensions-except=${EXTENSION_PATH}`,
  35 |         `--load-extension=${EXTENSION_PATH}`,
  36 |         '--allow-file-access-from-files',
  37 |         '--no-sandbox',
  38 |       ],
  39 |     });
  40 |     await use(context);
  41 |     await context.close();
  42 |   },
  43 | 
  44 |   extensionId: async ({ context }, use) => {
  45 |     // Service worker registers the extension; grab its ID from sw targets
  46 |     let [background] = context.serviceWorkers();
  47 |     if (!background) {
  48 |       background = await context.waitForEvent('serviceworker');
  49 |     }
  50 |     const extensionId = background.url().split('/')[2];
  51 |     await use(extensionId);
  52 |   },
  53 | 
  54 |   page: async ({ context }, use) => {
  55 |     const page = await context.newPage();
  56 |     await use(page);
  57 |   },
  58 | });
  59 | 
  60 | export { expect } from '@playwright/test';
  61 | 
```