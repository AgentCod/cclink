# npm publish setup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure `cclink` package.json and workflow so `npm publish` works correctly and produces a well-described npm package page.

**Architecture:** Two file changes only — update `package.json` with metadata and `prepublishOnly` script. No new files needed since `files: ["dist"]` already handles publish filtering.

**Tech Stack:** Node.js, npm, TypeScript, esbuild

---

### Task 1: Update package.json with metadata and prepublishOnly script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add metadata and prepublishOnly to package.json**

Open `package.json` and update it to:

```json
{
  "name": "cclink",
  "version": "0.1.0",
  "description": "Manage multiple Claude Code accounts via symlinks",
  "type": "module",
  "bin": {
    "cclink": "./dist/cclink.js"
  },
  "scripts": {
    "build": "node --import tsx/esm esbuild.config.ts",
    "prepublishOnly": "npm run build"
  },
  "author": "Minh Trung <minhtrungvn6868@gmail.com>",
  "repository": {
    "type": "git",
    "url": "https://github.com/AgentCod/cclink.git"
  },
  "homepage": "https://github.com/AgentCod/cclink",
  "bugs": {
    "url": "https://github.com/AgentCod/cclink/issues"
  },
  "dependencies": {
    "@clack/prompts": "^0.9.0",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "esbuild": "^0.21.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0"
  },
  "engines": { "node": ">=18" },
  "files": ["dist"],
  "keywords": ["claude", "claude-code", "account", "switch"],
  "license": "MIT"
}
```

- [ ] **Step 2: Verify build still works**

```bash
npm run build
```

Expected output:
```
Build complete: dist/cclink.js
```

- [ ] **Step 3: Verify published file list with npm pack dry-run**

```bash
npm pack --dry-run
```

Expected: only `dist/cclink.js` listed (plus `package.json` and `README.md` which npm always includes).

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: add npm publish metadata and prepublishOnly script"
```

---

### Task 2: Publish to npm

> These steps are manual — run them when ready to release.

- [ ] **Step 1: Login to npm (one-time)**

```bash
npm login
npm whoami   # should print your npm username
```

- [ ] **Step 2: Publish**

```bash
npm publish
```

This will automatically run `npm run build` first via `prepublishOnly`, then publish.

- [ ] **Step 3: Verify on npm**

Visit: https://www.npmjs.com/package/cclink

Should show version `0.1.0`, description, repository link, and author.

- [ ] **Step 4: Test install globally**

```bash
npm install -g cclink
cclink --help
```

Expected: cclink CLI help text displays correctly.

---

## Version bump workflow (for future releases)

```bash
git status                  # ensure clean tree
npm version patch            # or minor / major
npm publish
```
