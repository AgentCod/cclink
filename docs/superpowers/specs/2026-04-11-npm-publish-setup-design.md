# Design: npm publish setup for cclink

## Overview

Setup `cclink` CLI package for manual publishing to npm registry.

## Scope

Manual publish only (`npm publish`). No CI/CD automation.

## Changes

### 1. `package.json` updates

Add metadata fields:

- `author`: `"Minh Trung <minhtrungvn6868@gmail.com>"`
- `repository`: `{ "type": "git", "url": "https://github.com/AgentCod/cclink.git" }`
- `homepage`: `"https://github.com/AgentCod/cclink"`
- `bugs`: `{ "url": "https://github.com/AgentCod/cclink/issues" }`

Add `prepublishOnly` script to ensure `dist/` is always up to date before publishing:

```json
"prepublishOnly": "npm run build"
```

### 2. `.npmignore`

Exclude files not needed by consumers:

```
src/
esbuild.config.ts
tsconfig.json
plan
node_modules/
```

The `files` field in `package.json` already specifies `["dist"]`, so `.npmignore` is an extra safety net.

## Publish workflow

```bash
npm login        # one-time login
npm publish      # builds automatically via prepublishOnly, then publishes
```

For version bumps:

```bash
npm version patch   # or minor / major
npm publish
```

## Out of scope

- GitHub Actions / CI publishing
- Scoped packages (`@agentcod/cclink`)
- Provenance / signing
