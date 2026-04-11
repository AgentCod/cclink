# cclink — Design Spec
Date: 2026-04-11

## Overview

`cclink` is a Node.js CLI tool written in TypeScript that manages multiple Claude Code accounts by symlinking `~/.claude` and `~/.claude.json` to isolated per-account directories stored in a configurable root path.

## Goals

- Switch between Claude Code accounts without manual file management
- Isolate all account data: history, sessions, settings, credentials
- Display account info (email, billing, subscription date) from stored data
- Build as a lightweight esbuild bundle, published to npm

## Non-Goals

- Managing Claude API keys or token refresh
- Supporting accounts stored remotely

---

## Architecture

### Project Structure

```
cclink/
  src/
    index.ts              ← CLI entry point, command routing
    commands/
      setup.ts            ← cclink setup --path <path>
      login.ts            ← cclink login <account-name>
      switch.ts           ← cclink switch <account-name>
      status.ts           ← cclink status
    lib/
      config.ts           ← read/write ~/.cclink.json
      symlink.ts          ← symlink creation, deletion, real-dir detection
      claude-info.ts      ← read .claude.json for email/billing info
  package.json
  tsconfig.json
  esbuild.config.ts
```

### Config File: `~/.cclink.json`

```json
{
  "rootPath": "/path/to/account-storage",
  "activeAccount": "work"
}
```

Stored at `~/.cclink.json`. Created by `cclink setup`.

### Storage Layout

```
rootPath/
  work/
    .claude/          ← actual Claude data dir for "work" account
    .claude.json      ← Claude config file for "work" account
  personal/
    .claude/
    .claude.json
  default/            ← backup destination for pre-existing real dirs
    .claude/
    .claude.json
```

Symlinks in home directory point into this storage:
- `~/.claude` → `rootPath/<activeAccount>/.claude`
- `~/.claude.json` → `rootPath/<activeAccount>/.claude.json`

---

## Commands

### `cclink setup --path <path>`

1. Validate `<path>` is a valid absolute directory path
2. Create the directory if it does not exist
3. Write `{ rootPath: path }` to `~/.cclink.json`
4. Show success confirmation via `@clack/prompts`

### `cclink login <account-name>`

1. Read `~/.cclink.json` — error if `rootPath` not set (prompt to run setup)
2. Create `rootPath/account-name/` if it does not exist
3. For each of `~/.claude` and `~/.claude.json`:
   - If it is a symlink → remove the symlink
   - If it is a real directory/file → ask user via `@clack/prompts`:
     - **Backup to `rootPath/default/`** — move to default, then proceed
     - **Cancel** — abort without changes
4. Move real dir/file into `rootPath/account-name/` if no data exists there yet
5. Create symlinks:
   - `~/.claude` → `rootPath/account-name/.claude`
   - `~/.claude.json` → `rootPath/account-name/.claude.json`
6. Update `activeAccount` in `~/.cclink.json`
7. Spawn `claude login` as a child process

### `cclink switch <account-name>`

Same as `login` steps 1–6, but:
- Step 2: error if `rootPath/account-name/` does not exist (account must be created via `login` first)
- No step 7 (does not run `claude login`)

### `cclink status`

1. Read `rootPath` from `~/.cclink.json`
2. List all subdirectories in `rootPath`
3. For each account dir, attempt to read `rootPath/account-name/.claude.json`:
   - Extract `oauthAccount.emailAddress`, `oauthAccount.subscriptionCreatedAt`, `oauthAccount.billingType`
   - Show `—` if file not present or field missing
4. Render interactive select list via `@clack/prompts`:
   - Show active account with a marker
   - Format: `account-name | email | billing | since date`
5. On selection → run switch logic (steps 3–6 of switch command)

---

## Error Handling

| Situation | Behavior |
|---|---|
| `rootPath` not configured | Error with message: "Run `cclink setup --path <path>` first" |
| Account dir not found (switch) | Error: "Account '<name>' not found. Use `cclink login <name>` to create it." |
| `~/.claude` is real dir, user cancels | Abort, no changes made |
| `rootPath/account-name/` has data, real dir also present | Ask user to confirm overwrite or cancel |
| `claude login` not found in PATH | Show friendly error |

---

## Build & Publish

- **Bundler**: esbuild — single output file `dist/cclink.js`
- **Target**: Node.js 18+
- **npm bin**: `"cclink": "dist/cclink.js"` with `#!/usr/bin/env node` shebang
- **Dependencies**: `@clack/prompts`, `commander` (or manual arg parsing)
- **Dev dependencies**: `typescript`, `esbuild`
- Published to npm as `cclink`

---

## Key Constraints

- TypeScript, no runtime type-checking libraries needed
- Use `@clack/prompts` for all interactive UI
- Symlink operations use Node.js `fs` module directly
- No external dependencies beyond `@clack/prompts` and arg parser
