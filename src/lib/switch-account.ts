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
