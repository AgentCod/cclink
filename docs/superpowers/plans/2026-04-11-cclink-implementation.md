# cclink Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `cclink` — a TypeScript CLI that manages multiple Claude Code accounts by symlinking `~/.claude` and `~/.claude.json` to isolated per-account directories.

**Architecture:** Single esbuild-bundled Node.js binary. Commands are in `src/commands/`, shared logic in `src/lib/`. `@clack/prompts` handles all interactive UI. `commander` handles CLI argument parsing.

**Tech Stack:** TypeScript, Node.js 18+, `@clack/prompts`, `commander`, `esbuild`

---

## File Map

| File | Responsibility |
|---|---|
| `src/index.ts` | Entry point — wires `commander` commands to command modules |
| `src/commands/setup.ts` | `cclink setup --path <path>` |
| `src/commands/login.ts` | `cclink login <account-name>` |
| `src/commands/switch.ts` | `cclink switch <account-name>` |
| `src/commands/status.ts` | `cclink status` / `cclink list` (alias) |
| `src/lib/config.ts` | Read/write `~/.cclink.json` |
| `src/lib/symlink.ts` | Symlink creation, removal, real-dir detection |
| `src/lib/handle-real-dirs.ts` | Shared logic: detect real dirs, prompt backup, move to backup |
| `src/lib/claude-info.ts` | Read `rootPath/account/.claude.json` → extract email/billing |
| `src/lib/switch-account.ts` | Core switch logic: handle-real-dirs + create symlinks + update config |
| `src/lib/validate.ts` | Account name validation |
| `esbuild.config.ts` | esbuild build script |
| `package.json` | Dependencies, bin entry, scripts |
| `tsconfig.json` | TypeScript config |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.ts`
- Create: `src/index.ts` (stub)

- [ ] **Step 1: Create package.json**

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
    "build": "node --import tsx/esm esbuild.config.ts"
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
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src", "esbuild.config.ts"]
}
```

- [ ] **Step 3: Create esbuild.config.ts**

```typescript
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/cclink.js',
  banner: {
    js: '#!/usr/bin/env node',
  },
  minify: true,
});
```

- [ ] **Step 4: Create src/index.ts stub**

```typescript
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const program = new Command();
program
  .name('cclink')
  .description('Manage multiple Claude Code accounts via symlinks')
  .version(pkg.version);

program.parse();
```

- [ ] **Step 5: Install dependencies**

```bash
npm install
```

- [ ] **Step 6: Build and verify**

```bash
node --import tsx/esm esbuild.config.ts
node dist/cclink.js --version
```

Expected: prints `0.1.0`

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json esbuild.config.ts src/index.ts package-lock.json
git commit -m "chore: scaffold cclink project"
```

---

## Task 2: Config Library (`src/lib/config.ts`)

**Files:**
- Create: `src/lib/config.ts`

Config manages `~/.cclink.json`. Shape: `{ rootPath: string; activeAccount?: string }`.

- [ ] **Step 1: Create src/lib/config.ts**

```typescript
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_PATH = join(homedir(), '.cclink.json');

export interface CclinkConfig {
  rootPath: string;
  activeAccount?: string;
}

export function readConfig(): CclinkConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.rootPath !== 'string') return null;
    return parsed as CclinkConfig;
  } catch {
    return null;
  }
}

export function writeConfig(config: CclinkConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

export function requireConfig(): CclinkConfig {
  const config = readConfig();
  if (!config) {
    console.error('Error: cclink is not configured. Run `cclink setup --path <path>` first.');
    process.exit(1);
  }
  return config;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/config.ts
git commit -m "feat: add config read/write library"
```

---

## Task 3: Validate Library (`src/lib/validate.ts`)

**Files:**
- Create: `src/lib/validate.ts`

- [ ] **Step 1: Create src/lib/validate.ts**

```typescript
/**
 * Valid account names: non-empty, no '/', not '.' or '..'
 * Dots within names (e.g. 'john.doe') are allowed.
 */
export function isValidAccountName(name: string): boolean {
  if (!name || name.length === 0) return false;
  if (name === '.' || name === '..') return false;
  if (name.includes('/')) return false;
  return true;
}

export function assertValidAccountName(name: string): void {
  if (!isValidAccountName(name)) {
    console.error(
      `Error: Invalid account name "${name}". ` +
      `Account names must not be empty, '.' or '..', or contain slashes.`
    );
    process.exit(1);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/validate.ts
git commit -m "feat: add account name validation"
```

---

## Task 4: Symlink Library (`src/lib/symlink.ts`)

**Files:**
- Create: `src/lib/symlink.ts`

- [ ] **Step 1: Create src/lib/symlink.ts**

```typescript
import { existsSync, lstatSync, mkdirSync, renameSync, rmSync, symlinkSync } from 'node:fs';

export type PathStatus = 'missing' | 'symlink' | 'real';

export function getPathStatus(p: string): PathStatus {
  try {
    const stat = lstatSync(p);
    return stat.isSymbolicLink() ? 'symlink' : 'real';
  } catch {
    return 'missing';
  }
}

/** Remove a symlink at path. Throws if not a symlink. */
export function removeSymlink(p: string): void {
  rmSync(p);
}

/** Create a symlink: linkPath → target */
export function createSymlink(target: string, linkPath: string): void {
  symlinkSync(target, linkPath);
}

/** Move a real file or directory from src to dest/basename(src) */
export function moveToDir(src: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });
  const name = src.split('/').pop()!;
  renameSync(src, `${destDir}/${name}`);
}

export function ensureDir(p: string): void {
  mkdirSync(p, { recursive: true });
}

export function dirExists(p: string): boolean {
  return existsSync(p) && lstatSync(p).isDirectory();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/symlink.ts
git commit -m "feat: add symlink utility library"
```

---

## Task 5: Handle Real Dirs (`src/lib/handle-real-dirs.ts`)

**Files:**
- Create: `src/lib/handle-real-dirs.ts`

This is the shared logic used by both `login` and `switch`. Prompts user if real dirs found.

- [ ] **Step 1: Create src/lib/handle-real-dirs.ts**

```typescript
import * as p from '@clack/prompts';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { dirExists, getPathStatus, moveToDir, removeSymlink } from './symlink.js';
import { isValidAccountName } from './validate.js';

const HOME = homedir();
const CLAUDE_DIR = join(HOME, '.claude');
const CLAUDE_JSON = join(HOME, '.claude.json');

const TARGETS = [CLAUDE_DIR, CLAUDE_JSON];

/**
 * For each of ~/.claude and ~/.claude.json:
 *   - missing → skip
 *   - symlink → remove silently
 *   - real dir/file → collect for backup prompt
 *
 * If real items found, prompt user to backup or cancel.
 * Returns false if user cancelled, true if all clear.
 */
export async function handleRealDirs(rootPath: string): Promise<boolean> {
  const realItems: string[] = [];

  for (const target of TARGETS) {
    const status = getPathStatus(target);
    if (status === 'missing') continue;
    if (status === 'symlink') {
      removeSymlink(target);
      continue;
    }
    // real
    realItems.push(target);
  }

  if (realItems.length === 0) return true;

  p.log.warn(`Found existing real directories/files that need to be backed up:`);
  for (const item of realItems) {
    p.log.message(`  ${item}`);
  }

  const choice = await p.select({
    message: 'What would you like to do?',
    options: [
      { value: 'backup', label: 'Backup to a named account folder' },
      { value: 'cancel', label: 'Cancel — make no changes' },
    ],
  });

  if (p.isCancel(choice) || choice === 'cancel') {
    p.cancel('Aborted. No changes made.');
    return false;
  }

  // Get unique backup name
  let backupName: string = '';
  while (true) {
    const input = await p.text({
      message: 'Enter backup account name:',
      placeholder: 'default',
      defaultValue: 'default',
    });

    if (p.isCancel(input)) {
      p.cancel('Aborted. No changes made.');
      return false;
    }

    const name = (input as string).trim() || 'default';

    if (!isValidAccountName(name)) {
      p.log.error(`Invalid name "${name}". Must not be empty, '.', '..', or contain slashes.`);
      continue;
    }

    if (dirExists(join(rootPath, name))) {
      p.log.error(`Account "${name}" already exists. Choose a different name.`);
      continue;
    }

    backupName = name;
    break;
  }

  const backupDir = join(rootPath, backupName);
  for (const item of realItems) {
    moveToDir(item, backupDir);
  }

  p.log.success(`Backed up to ${backupDir}`);
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/handle-real-dirs.ts
git commit -m "feat: add shared handle-real-dirs logic"
```

---

## Task 6: Claude Info Library (`src/lib/claude-info.ts`)

**Files:**
- Create: `src/lib/claude-info.ts`

Reads account metadata from `rootPath/account-name/.claude.json`.

- [ ] **Step 1: Create src/lib/claude-info.ts**

```typescript
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ClaudeAccountInfo {
  email: string;
  billingType: string;
  subscribedAt: string; // formatted date string or '—'
}

export function readClaudeInfo(accountDir: string): ClaudeAccountInfo {
  const filePath = join(accountDir, '.claude.json');
  const fallback: ClaudeAccountInfo = { email: '—', billingType: '—', subscribedAt: '—' };

  if (!existsSync(filePath)) return fallback;

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    const oauth = raw?.oauthAccount;
    if (!oauth) return fallback;

    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return {
      email: oauth.emailAddress ?? '—',
      billingType: oauth.billingType ?? '—',
      subscribedAt: oauth.subscriptionCreatedAt
        ? formatter.format(new Date(oauth.subscriptionCreatedAt))
        : '—',
    };
  } catch {
    return fallback;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/claude-info.ts
git commit -m "feat: add claude account info reader"
```

---

## Task 7: Switch Account Library (`src/lib/switch-account.ts`)

**Files:**
- Create: `src/lib/switch-account.ts`

Core switch logic: run handle-real-dirs, create symlinks, update config.

- [ ] **Step 1: Create src/lib/switch-account.ts**

```typescript
import * as p from '@clack/prompts';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readConfig, writeConfig } from './config.js';
import { handleRealDirs } from './handle-real-dirs.js';
import { createSymlink, ensureDir } from './symlink.js';

const HOME = homedir();

/**
 * Core switch: handle real dirs, create symlinks, update config.
 * accountDir must already exist (caller validates).
 * createIfMissing=true is used by login to create the account dir after the backup prompt.
 */
export async function switchAccount(
  rootPath: string,
  accountName: string,
  opts: { createIfMissing?: boolean } = {}
): Promise<boolean> {
  const accountDir = join(rootPath, accountName);

  // Handle real dirs BEFORE creating the account dir
  const ok = await handleRealDirs(rootPath);
  if (!ok) return false;

  // Create account dir after backup prompt (so cancel leaves no orphan)
  if (opts.createIfMissing) {
    ensureDir(accountDir);
  }

  // Create symlinks
  createSymlink(join(accountDir, '.claude'), join(HOME, '.claude'));
  createSymlink(join(accountDir, '.claude.json'), join(HOME, '.claude.json'));

  // Update config
  const config = readConfig()!;
  writeConfig({ ...config, activeAccount: accountName });

  p.log.success(`Switched to account: ${accountName}`);
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/switch-account.ts
git commit -m "feat: add switch-account core logic"
```

---

## Task 8: Setup Command (`src/commands/setup.ts`)

**Files:**
- Create: `src/commands/setup.ts`

- [ ] **Step 1: Create src/commands/setup.ts**

```typescript
import * as p from '@clack/prompts';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, resolve } from 'node:path';
import { readConfig, writeConfig } from '../lib/config.js';

export async function setupCommand(rawPath: string): Promise<void> {
  p.intro('cclink setup');

  // Expand ~ manually
  const expandedPath = rawPath.startsWith('~/')
    ? rawPath.replace('~', homedir())
    : rawPath;

  const resolvedPath = resolve(expandedPath);

  if (!isAbsolute(resolvedPath)) {
    p.log.error('Path must be absolute.');
    process.exit(1);
  }

  // Reject paths inside ~/.claude
  const claudeDir = `${homedir()}/.claude`;
  if (resolvedPath.startsWith(claudeDir)) {
    p.log.error('Path cannot be inside ~/.claude.');
    process.exit(1);
  }

  // Warn if rootPath already set to a different path
  const existing = readConfig();
  if (existing && existing.rootPath !== resolvedPath) {
    const confirm = await p.confirm({
      message: `rootPath is already set to "${existing.rootPath}". Overwrite? (existing account data will NOT be moved)`,
    });
    if (p.isCancel(confirm) || !confirm) {
      p.cancel('Aborted.');
      process.exit(0);
    }
  }

  // Create directory
  if (!existsSync(resolvedPath)) {
    mkdirSync(resolvedPath, { recursive: true });
  }

  // Write config
  writeConfig({
    rootPath: resolvedPath,
    activeAccount: existing?.activeAccount,
  });

  p.outro(`Setup complete. Root path: ${resolvedPath}`);
}
```

- [ ] **Step 2: Wire into src/index.ts**

Add to `src/index.ts`:

```typescript
import { setupCommand } from './commands/setup.js';

program
  .command('setup')
  .description('Configure root storage path for account data')
  .requiredOption('--path <path>', 'Absolute path to store account data')
  .action(async (opts) => {
    await setupCommand(opts.path);
  });
```

- [ ] **Step 3: Build and smoke test**

```bash
node --import tsx/esm esbuild.config.ts
node dist/cclink.js setup --path /tmp/cclink-test
```

Expected: "Setup complete. Root path: /tmp/cclink-test"

- [ ] **Step 4: Commit**

```bash
git add src/commands/setup.ts src/index.ts
git commit -m "feat: add setup command"
```

---

## Task 9: Login Command (`src/commands/login.ts`)

**Files:**
- Create: `src/commands/login.ts`

- [ ] **Step 1: Create src/commands/login.ts**

```typescript
import * as p from '@clack/prompts';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { requireConfig } from '../lib/config.js';
import { dirExists } from '../lib/symlink.js';
import { switchAccount } from '../lib/switch-account.js';
import { assertValidAccountName } from '../lib/validate.js';

export async function loginCommand(accountName: string): Promise<void> {
  p.intro(`cclink login: ${accountName}`);

  assertValidAccountName(accountName);

  const config = requireConfig();
  const { rootPath } = config;

  if (!dirExists(rootPath)) {
    p.log.error(`Root path "${rootPath}" does not exist. Re-run \`cclink setup\`.`);
    process.exit(1);
  }

  const ok = await switchAccount(rootPath, accountName, { createIfMissing: true });
  if (!ok) process.exit(0);

  // Run claude login
  p.log.step('Running `claude login`...');
  await runClaudeLogin();
}

function runClaudeLogin(): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn('claude', ['login'], { stdio: 'inherit' });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        console.error('`claude` not found. Is Claude Code installed?');
      } else {
        console.error(`Failed to spawn claude: ${err.message}`);
      }
      process.exit(1);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.warn(`Warning: claude login exited with code ${code}`);
      }
      resolve();
    });
  });
}
```

- [ ] **Step 2: Wire into src/index.ts**

```typescript
import { loginCommand } from './commands/login.js';

program
  .command('login <account-name>')
  .description('Create account and link ~/.claude, then run claude login')
  .action(async (accountName) => {
    await loginCommand(accountName);
  });
```

- [ ] **Step 3: Build and smoke test**

```bash
node --import tsx/esm esbuild.config.ts
node dist/cclink.js login --help
```

Expected: shows login command help

- [ ] **Step 4: Commit**

```bash
git add src/commands/login.ts src/index.ts
git commit -m "feat: add login command"
```

---

## Task 10: Switch Command (`src/commands/switch.ts`)

**Files:**
- Create: `src/commands/switch.ts`

- [ ] **Step 1: Create src/commands/switch.ts**

```typescript
import * as p from '@clack/prompts';
import { join } from 'node:path';
import { requireConfig } from '../lib/config.js';
import { dirExists } from '../lib/symlink.js';
import { switchAccount } from '../lib/switch-account.js';
import { assertValidAccountName } from '../lib/validate.js';

export async function switchCommand(accountName: string): Promise<void> {
  p.intro(`cclink switch: ${accountName}`);

  assertValidAccountName(accountName);

  const config = requireConfig();
  const { rootPath } = config;

  if (!dirExists(rootPath)) {
    p.log.error(`Root path "${rootPath}" does not exist. Re-run \`cclink setup\`.`);
    process.exit(1);
  }

  const accountDir = join(rootPath, accountName);
  if (!dirExists(accountDir)) {
    p.log.error(
      `Account "${accountName}" not found. Use \`cclink login ${accountName}\` to create it.`
    );
    process.exit(1);
  }

  const ok = await switchAccount(rootPath, accountName);
  if (!ok) process.exit(0);
}
```

- [ ] **Step 2: Wire into src/index.ts**

```typescript
import { switchCommand } from './commands/switch.js';

program
  .command('switch <account-name>')
  .description('Switch active account (account must exist via cclink login first)')
  .action(async (accountName) => {
    await switchCommand(accountName);
  });
```

- [ ] **Step 3: Build and smoke test**

```bash
node --import tsx/esm esbuild.config.ts
node dist/cclink.js switch --help
```

- [ ] **Step 4: Commit**

```bash
git add src/commands/switch.ts src/index.ts
git commit -m "feat: add switch command"
```

---

## Task 11: Status / List Command (`src/commands/status.ts`)

**Files:**
- Create: `src/commands/status.ts`

- [ ] **Step 1: Create src/commands/status.ts**

```typescript
import * as p from '@clack/prompts';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readClaudeInfo } from '../lib/claude-info.js';
import { requireConfig } from '../lib/config.js';
import { dirExists } from '../lib/symlink.js';
import { switchAccount } from '../lib/switch-account.js';

export async function statusCommand(): Promise<void> {
  p.intro('cclink status');

  const config = requireConfig();
  const { rootPath, activeAccount } = config;

  if (!dirExists(rootPath)) {
    p.log.error(`Root path "${rootPath}" does not exist. Re-run \`cclink setup\`.`);
    process.exit(1);
  }

  // List all subdirs as accounts
  let accounts: string[];
  try {
    accounts = readdirSync(rootPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    accounts = [];
  }

  if (accounts.length === 0) {
    p.log.info('No accounts found. Run `cclink login <name>` to get started.');
    process.exit(0);
  }

  // Build select options — include dangling activeAccount even if dir is gone
  const allNames = [...new Set([...accounts, ...(activeAccount && !accounts.includes(activeAccount) ? [activeAccount] : [])])];

  const options = allNames.map((name) => {
    const accountDir = join(rootPath, name);
    const isActive = name === activeAccount;
    const marker = isActive ? '●' : '○';
    // For dangling activeAccount, dir won't exist — info will return all '—'
    const info = readClaudeInfo(accountDir);
    const label = `${marker} ${name.padEnd(16)} ${info.email.padEnd(30)} ${info.billingType.padEnd(20)} ${info.subscribedAt}`;

    return { value: name, label };
  });

  const selected = await p.select({
    message: 'Select an account to switch to (Enter to confirm, Esc to cancel):',
    options,
  });

  if (p.isCancel(selected)) {
    process.exit(0);
  }

  const chosen = selected as string;

  // Account dir may have been deleted since list was built
  const chosenDir = join(rootPath, chosen);
  if (!dirExists(chosenDir)) {
    p.log.error(
      `Account "${chosen}" not found. Use \`cclink login ${chosen}\` to create it.`
    );
    process.exit(1);
  }

  const ok = await switchAccount(rootPath, chosen);
  if (!ok) process.exit(0);
}
```

- [ ] **Step 2: Wire into src/index.ts**

```typescript
import { statusCommand } from './commands/status.js';

program
  .command('status')
  .description('List accounts and optionally switch')
  .action(async () => {
    await statusCommand();
  });

program
  .command('list')
  .description('Alias for status')
  .action(async () => {
    await statusCommand();
  });
```

- [ ] **Step 3: Build and smoke test**

```bash
node --import tsx/esm esbuild.config.ts
node dist/cclink.js status
```

Expected: shows interactive list of accounts in `/tmp/cclink-test` (or configured rootPath)

- [ ] **Step 4: Commit**

```bash
git add src/commands/status.ts src/index.ts
git commit -m "feat: add status and list commands"
```

---

## Task 12: Final Build, chmod, and npm Publish Prep

**Files:**
- Modify: `esbuild.config.ts` (add chmod step)
- Modify: `package.json` (add `files`, `engines`, `publishConfig`)

- [ ] **Step 1: Update esbuild.config.ts to chmod the output**

```typescript
import { build } from 'esbuild';
import { chmodSync } from 'node:fs';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/cclink.js',
  banner: {
    js: '#!/usr/bin/env node',
  },
  minify: true,
});

chmodSync('dist/cclink.js', 0o755);
console.log('Build complete: dist/cclink.js');
```

- [ ] **Step 2: Update package.json for publish**

Add these fields to `package.json`:

```json
{
  "engines": { "node": ">=18" },
  "files": ["dist"],
  "keywords": ["claude", "claude-code", "account", "switch"],
  "license": "MIT"
}
```

- [ ] **Step 3: Final build**

```bash
node --import tsx/esm esbuild.config.ts
```

Expected: "Build complete: dist/cclink.js"

- [ ] **Step 4: Test the binary directly**

```bash
./dist/cclink.js --version
./dist/cclink.js --help
./dist/cclink.js setup --help
./dist/cclink.js login --help
./dist/cclink.js switch --help
./dist/cclink.js status --help
```

All should print usage/version without errors.

- [ ] **Step 5: Test npm link locally**

```bash
npm link
cclink --version
cclink --help
```

Expected: `cclink` runs as a global command.

- [ ] **Step 6: Commit**

```bash
git add esbuild.config.ts package.json
git commit -m "chore: add chmod, publish config, final build setup"
```

---

## Task 13: End-to-End Smoke Test

No automated tests — manually verify the full workflow.

- [ ] **Step 1: Setup**

```bash
cclink setup --path ~/cclink-accounts-test
```

Expected: "Setup complete."

- [ ] **Step 2: Login to a test account**

```bash
cclink login test-account
```

Expected: prompts if real dirs found, creates symlinks, runs `claude login`.
Verify: `ls -la ~/.claude` → should be a symlink to `~/cclink-accounts-test/test-account/.claude`

- [ ] **Step 3: Status shows account**

```bash
cclink status
```

Expected: shows `● test-account` with any available email info.

- [ ] **Step 4: Login to a second account**

```bash
cclink login second-account
```

Expected: old symlinks removed, new symlinks created for `second-account`.

- [ ] **Step 5: Switch back**

```bash
cclink switch test-account
```

Expected: symlinks updated back to `test-account`.

- [ ] **Step 6: List alias works**

```bash
cclink list
```

Expected: same as `cclink status`.

- [ ] **Step 7: Commit**

```bash
git add src/ dist/ package.json
git commit -m "chore: end-to-end smoke test verified"
```

---

## Publish to npm

When ready to publish:

```bash
npm login
npm publish
```
