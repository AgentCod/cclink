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
      status.ts           ← cclink status / cclink list
    lib/
      config.ts           ← read/write ~/.cclink.json
      symlink.ts          ← symlink creation, deletion, real-dir detection
      claude-info.ts      ← read .claude.json for email/billing info
      switch-account.ts   ← shared switch logic used by switch, status, list
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

Stored at `~/.cclink.json`. Created by `cclink setup`. `activeAccount` is absent until first `login` or `switch` — all commands that read it must treat a missing value as "no active account".

### Storage Layout

```
rootPath/
  work/
    .claude/          ← actual Claude data dir for "work" account
    .claude.json      ← Claude config file for "work" account
  personal/
    .claude/
    .claude.json
```

> Note: `default` is NOT a reserved directory name. The backup prompt asks the user to choose a name (defaulting to `"default"`). Any subdir of `rootPath` is treated as an account.

Symlinks in home directory point into this storage:
- `~/.claude` → `rootPath/<activeAccount>/.claude`
- `~/.claude.json` → `rootPath/<activeAccount>/.claude.json`

---

## Commands

### `cclink setup --path <path>`

- `--path` is required; error if omitted
- Validate: path must be absolute (reject relative paths). Tilde `~` is expanded. Paths inside `~/.claude` are rejected.
- If `~/.cclink.json` already exists with a different `rootPath`, prompt user for confirmation before overwriting (warn that existing account data will not be moved)
- Create the directory if it does not exist
- Write `{ rootPath: path }` to `~/.cclink.json` (preserve existing `activeAccount` if present — note: if `rootPath` changes, `activeAccount` may reference a name that does not exist in the new root; this is acceptable and will surface as a normal "account not found" error on next command)
- Show success confirmation via `@clack/prompts`

### Shared: Handle real dirs at `~/.claude` / `~/.claude.json`

This logic is used by both `login` and `switch`:

1. Evaluate each of `~/.claude` and `~/.claude.json` independently:
   - If it **does not exist** → skip
   - If it is a **symlink** → remove it silently
   - If it is a **real directory or file** → collect it for the backup prompt
2. If any real items were collected, show a **single combined prompt** listing them, asking:
   - **Backup** — ask for a backup account name (default: `"default"`). If that name already exists as a dir in `rootPath`, prompt again with an error until user enters a unique name or cancels. Move each real item to `rootPath/<backup-name>/`.
   - **Cancel** — abort immediately, no changes made
3. After this step, `~/.claude` and `~/.claude.json` are either gone, were symlinks (removed), or were real (moved to backup). The home dir slots are now free.

> **Rule**: real dirs are always moved to the backup account — never seeded into the target account. The target account's existing data (if any) is always preserved as-is.

### `cclink login <account-name>`

1. Validate account name: must be a valid single directory name component — reject empty string, `/`, and the literal strings `.` and `..`. Names containing dots (e.g. `john.doe`) are allowed. Error if invalid.
2. Read `~/.cclink.json` — error if `rootPath` not set. Error if `rootPath` dir does not exist on disk.
3. Run **Handle real dirs** (shared logic above). If user cancels here, abort — no account dir is created.
4. Create `rootPath/account-name/` if it does not exist (after the backup prompt, so cancel leaves no orphan dir).
5. Create symlinks:
   - `~/.claude` → `rootPath/account-name/.claude`
   - `~/.claude.json` → `rootPath/account-name/.claude.json`
6. Update `activeAccount: account-name` in `~/.cclink.json`.
7. Spawn `claude login` as a child process with `stdio: 'inherit'`. Two failure modes:
   - If spawn fails with `ENOENT` → show "`claude` not found. Is Claude Code installed?" and exit with error code.
   - If process exits with non-zero code → show a warning ("claude login exited with code N") but do not roll back symlinks.

### `cclink switch <account-name>`

1. Validate account name (same as login step 1).
2. Read `~/.cclink.json` — same errors as login step 2.
3. Error if `rootPath/account-name/` does not exist: "Account '<name>' not found. Use `cclink login <name>` to create it."
4. Run **Handle real dirs** (shared logic above). Real items are always backed up; existing account data is never overwritten.
5. Create symlinks (same as login step 5).
6. Update `activeAccount` in `~/.cclink.json`.

### `cclink status` / `cclink list`

`list` is an alias for `status`. Both commands behave identically.

1. Read `~/.cclink.json` — error if not configured. Error if `rootPath` does not exist on disk.
2. List all subdirectories in `rootPath` (all are treated as accounts).
3. For each account dir, attempt to read `rootPath/account-name/.claude.json`:
   - Extract `oauthAccount.emailAddress`, `oauthAccount.subscriptionCreatedAt`, `oauthAccount.billingType`
   - Show `—` if file not present or field missing
   - Format `subscriptionCreatedAt` as locale date string (e.g. `Apr 5, 2026`)
4. Render interactive select list via `@clack/prompts`:
   - Show active account (from `activeAccount` in config) with a `●` marker; others show `○`. If `activeAccount` references a deleted dir, show the marker but all fields as `—`.
   - Format per row: `● account-name  email@example.com  stripe_subscription  Apr 5, 2026`
   - Date formatted with `new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`
5. If user dismisses (Escape / Ctrl-C) → exit cleanly with no changes, no error message.
6. On selection → run switch logic (steps 3–6 of `cclink switch`). If the selected account's directory no longer exists (dangling `activeAccount` row), the switch step 3 error is shown: "Account '<name>' not found. Use `cclink login <name>` to create it." — the dangling row is selectable but produces this error.

---

## Error Handling

| Situation | Behavior |
|---|---|
| `--path` missing on setup | Error: "`--path <path>` is required" |
| `rootPath` not configured | Error: "Run `cclink setup --path <path>` first" |
| `rootPath` dir missing at runtime | Error: "Root path '<path>' does not exist. Re-run `cclink setup`." (`login`/`switch` do not recreate it) |
| Account dir not found (switch) | Error: "Account '<name>' not found. Use `cclink login <name>` to create it." |
| Invalid account name | Error: "Account name must be a valid directory name (no slashes, not empty, not '.' or '..')." |
| Real dir found, user cancels backup | Abort immediately, no changes made |
| Backup name already exists | Re-prompt for a different backup name |
| `~/.cclink.json` malformed / missing `rootPath` | Treat as "not configured": show "Run `cclink setup --path <path>` first" |
| `activeAccount` references deleted account dir | Render with `—` fields in status list, no error |
| No accounts found in `rootPath` | Show message: "No accounts found. Run `cclink login <name>` to get started." Exit cleanly. |
| `claude login` exits non-zero | Warning shown (login command only), symlinks remain in place |
| `claude` not found in PATH | Show friendly error: "`claude` not found. Is Claude Code installed?" (login only) |
| User dismisses status/list select | Exit cleanly, no error |

---

## Build & Publish

- **Bundler**: esbuild — single output file `dist/cclink.js`
- **Target**: Node.js 18+
- **npm bin**: `"cclink": "dist/cclink.js"` with `#!/usr/bin/env node` shebang
- **Dependencies**: `@clack/prompts`, `commander`
- **Dev dependencies**: `typescript`, `esbuild`
- Published to npm as `cclink`

---

## Key Constraints

- TypeScript, no runtime type-checking libraries needed
- Use `@clack/prompts` for all interactive UI
- Symlink operations use Node.js `fs` module directly
- No external dependencies beyond `@clack/prompts` and `commander`
- `cclink --version` works via `commander`'s built-in version support, sourced from `package.json`
- `cclink --help` works via `commander`'s built-in help generation
