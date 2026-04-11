# Design: npm publish setup for cclink

## Overview

Setup `cclink` CLI package for manual publishing to the public npm registry.

## Scope

Manual publish only (`npm publish`). No CI/CD automation.

## Changes

### 1. `package.json` updates

Add metadata fields:

```json
{
  "author": "Minh Trung <minhtrungvn6868@gmail.com>",
  "repository": { "type": "git", "url": "https://github.com/AgentCod/cclink.git" },
  "homepage": "https://github.com/AgentCod/cclink",
  "bugs": { "url": "https://github.com/AgentCod/cclink/issues" }
}
```

Add `prepublishOnly` script to auto-build before every publish:

```json
"scripts": {
  "build": "node --import tsx/esm esbuild.config.ts",
  "prepublishOnly": "npm run build"
}
```

No `.npmignore` needed — the `files: ["dist"]` field already restricts published files to `dist/` only (allowlist approach).

### 2. `.gitignore` check

Ensure `~/.npmrc` is not committed. The local project `.gitignore` should include `node_modules/` and `.env` at minimum (npm credentials are stored in `~/.npmrc` at the user level, not the project level).

## Publish workflow

```bash
# One-time setup
npm login          # authenticates and stores token in ~/.npmrc
npm whoami         # verify login succeeded

# Optional dry-run to inspect what files will be published
npm pack           # creates a .tgz — inspect contents before publishing

# Publish
npm publish        # triggers prepublishOnly (build), then publishes to npm
```

For subsequent version bumps:

```bash
git status         # ensure clean working tree before bumping
npm version patch  # or minor / major — updates package.json + creates a git tag
npm publish
```

## Out of scope

- GitHub Actions / CI publishing
- Scoped packages (`@agentcod/cclink`)
- Provenance / signing
