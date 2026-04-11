import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/cclink.js',
  banner: {
    // Shebang + createRequire shim: ESM bundles don't have require() by default,
    // but some CJS dependencies (e.g. commander internals) may call it at runtime.
    // The shim makes require() available without breaking the ESM format.
    // external: ['node:*'] ensures node: protocol imports (node:fs, node:path, etc.)
    // are not bundled — they're always available at runtime in Node.js.
    js: '#!/usr/bin/env node\nimport{createRequire}from"node:module";const require=createRequire(import.meta.url);',
  },
  external: ['node:*'],
  minify: true,
});
