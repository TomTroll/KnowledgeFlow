// packages/chrome-extension/esbuild.config.mjs
// Multi-entrypoint esbuild bundler for the KnowledgeFlow Chrome Extension.
// Produces separate bundles for: Service Worker, content script, action popup,
// and options page — as required by Manifest V3.
//
// CSS files imported via `import css from './style.css'` are inlined as
// text strings using the custom cssText plugin below. This keeps the
// Shadow DOM styles fully bundled inside content.js with no external fetch.

import esbuild from 'esbuild';
import { argv } from 'process';
import { readFile } from 'fs/promises';

const watch = argv.includes('--watch');

/**
 * esbuild plugin that resolves `*.css` imports as plain text strings.
 * Used to inline Shadow DOM styles directly into the JS bundle.
 *
 * @type {import('esbuild').Plugin}
 */
const cssTextPlugin = {
  name: 'css-text',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const css = await readFile(args.path, 'utf8');
      return {
        contents: `export default ${JSON.stringify(css)};`,
        loader: 'js',
      };
    });
  },
};

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
  plugins: [cssTextPlugin],
};

if (watch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('Watching for changes…');
} else {
  await esbuild.build(config);
}
