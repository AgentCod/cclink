import * as p from '@clack/prompts';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readConfig, writeConfig } from './config.js';
import { handleRealDirs } from './handle-real-dirs.js';
import { createSymlink, ensureDir } from './symlink.js';

const HOME = homedir();

/**
 * Core switch: handle real dirs, create symlinks, update config.
 * If createIfMissing=true (used by login), creates the account dir after the backup prompt.
 * Returns false if user cancelled or an error occurred; true on success.
 */
export async function switchAccount(
  rootPath: string,
  accountName: string,
  opts: { createIfMissing?: boolean } = {}
): Promise<boolean> {
  const accountDir = join(rootPath, accountName);

  // Handle real dirs BEFORE creating the account dir (cancel leaves no orphan)
  const ok = await handleRealDirs(rootPath);
  if (!ok) return false;

  // Create account dir after backup prompt
  if (opts.createIfMissing) {
    try {
      ensureDir(accountDir);
    } catch (err) {
      p.log.error(`Failed to create account directory: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  // Create symlinks (~/.claude → accountDir/.claude, ~/.claude.json → accountDir/.claude.json)
  try {
    createSymlink(join(accountDir, '.claude'), join(HOME, '.claude'));
    createSymlink(join(accountDir, '.claude.json'), join(HOME, '.claude.json'));
  } catch (err) {
    p.log.error(`Failed to create symlinks: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }

  // Update config
  const config = readConfig();
  if (!config) {
    p.log.error('Configuration not found. Run `cclink setup --path <path>` first.');
    return false;
  }
  writeConfig({ ...config, activeAccount: accountName });

  p.log.success(`Switched to account: ${accountName}`);
  return true;
}
