// packages/obsidian-plugin/esbuild.config.mjs
// Bundles the Obsidian plugin into a single main.js file.
// Obsidian loads plugins by requiring <vault>/.obsidian/plugins/<id>/main.js.

import esbuild from 'esbuild';
import { argv } from 'process';

const watch = argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const config = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/main.js',
  // Electron / Node.js runtime inside Obsidian
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info',
  // Obsidian and Electron built-ins must not be bundled
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
};

if (watch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('Watching for changes…');
} else {
  await esbuild.build(config);
}
