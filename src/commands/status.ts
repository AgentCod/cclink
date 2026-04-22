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

  p.log.info(`Root path: ${rootPath}`);
  p.log.info(`Active account: ${activeAccount ?? '(none)'}`);

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
