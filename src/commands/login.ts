import * as p from '@clack/prompts';
import { spawn } from 'node:child_process';
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
        p.log.error('`claude` not found. Is Claude Code installed?');
      } else {
        p.log.error(`Failed to spawn claude: ${err.message}`);
      }
      process.exit(1);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        p.log.warn(`claude login exited with code ${code}`);
      }
      resolve();
    });
  });
}
