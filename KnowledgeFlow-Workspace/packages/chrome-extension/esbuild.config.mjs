// packages/chrome-extension/esbuild.config.mjs
// Multi-entrypoint esbuild bundler for the KnowledgeFlow Chrome Extension.
// Produces separate bundles for: Service Worker, content script, action popup,
// and options page — as required by Manifest V3.

import esbuild from 'esbuild';
import { argv } from 'process';

const watch = argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const config = {
  entryPoints: {
    // Service Worker (MV3 background script)
    'dist/background': 'src/background.ts',
    // Content script injected into every page
    'dist/content': 'src/content.ts',
    // Action popup (toolbar icon click)
    'dist/popup': 'src/popup.ts',
    // Extension options page
    'dist/options': 'src/options.ts',
  },
  bundle: true,
  outdir: '.',
  platform: 'browser',
  target: 'chrome120',
  format: 'iife',
  sourcemap: true,
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('Watching for changes…');
} else {
  await esbuild.build(config);
}
