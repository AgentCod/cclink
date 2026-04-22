import * as p from '@clack/prompts';
import { join } from 'node:path';
import { requireConfig } from '../lib/config.js';
import { dirExists } from '../lib/symlink.js';
import { findAllClaudeCredentials, saveCertFile } from '../lib/keychain.js';

export async function saveCommand(): Promise<void> {
  p.intro('cclink save: saving keychain credentials');

  const config = requireConfig();
  const { rootPath, activeAccount } = config;

  if (!activeAccount) {
    p.log.error('No active account. Run `cclink switch <account-name>` first.');
    process.exit(1);
  }

  const accountDir = join(rootPath, activeAccount);
  if (!dirExists(accountDir)) {
    p.log.error(`Account directory "${accountDir}" not found.`);
    process.exit(1);
  }

  p.log.step('Reading Claude Code credentials from keychain...');
  const entries = findAllClaudeCredentials();

  if (entries.length === 0) {
    p.log.warn('No Claude Code credentials found in keychain.');
    process.exit(0);
  }

  const certPath = join(accountDir, '.cert.txt');
  saveCertFile(certPath, entries);

  for (const e of entries) {
    p.log.info(`  saved: ${e.service} (account: ${e.account})`);
  }

  p.outro(`Saved ${entries.length} credential(s) to ${certPath}`);
}
