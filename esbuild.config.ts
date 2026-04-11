import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/cclink.js',
  banner: {
    js: '#!/usr/bin/env node\nimport{createRequire}from"node:module";const require=createRequire(import.meta.url);',
  },
  external: ['node:*'],
  minify: true,
});
