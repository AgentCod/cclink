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

  p.outro(`Switched to account: ${accountName}`);
}
