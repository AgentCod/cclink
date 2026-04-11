import * as p from '@clack/prompts';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readConfig, writeConfig } from '../lib/config.js';
import { getPathStatus, removeSymlink } from '../lib/symlink.js';

const HOME = homedir();
const TARGETS = [join(HOME, '.claude'), join(HOME, '.claude.json')];

export async function disableCommand(): Promise<void> {
  p.intro('cclink disable');

  let removed = 0;
  for (const target of TARGETS) {
    const status = getPathStatus(target);
    if (status === 'symlink') {
      removeSymlink(target);
      p.log.info(`Removed symlink: ${target}`);
      removed++;
    } else if (status === 'real') {
      p.log.warn(`${target} is a real directory/file — skipping (nothing to unlink)`);
    } else {
      p.log.info(`${target} does not exist — skipping`);
    }
  }

  // Clear activeAccount from config
  const config = readConfig();
  if (config?.activeAccount) {
    writeConfig({ ...config, activeAccount: undefined });
    p.log.info('Cleared active account from config');
  }

  if (removed === 0) {
    p.outro('No symlinks found. Claude Code is already running normally.');
  } else {
    p.outro('Disabled. Claude Code will now use ~/.claude directly.');
  }
}
