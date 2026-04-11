import * as p from '@clack/prompts';
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { dirExists, getPathStatus, moveToDir, removeSymlink } from './symlink.js';
import { isValidAccountName } from './validate.js';

function isDirEmpty(dirPath: string): boolean {
  try {
    return readdirSync(dirPath).length === 0;
  } catch {
    return true;
  }
}

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

    const backupDir = join(rootPath, name);
    if (dirExists(backupDir)) {
      if (isDirEmpty(backupDir)) {
        // Empty folder — ok to use directly
        backupName = name;
        break;
      }
      // Non-empty — ask override or rename
      const action = await p.select({
        message: `Account "${name}" already exists and is not empty. What would you like to do?`,
        options: [
          { value: 'override', label: 'Override — backup into it anyway' },
          { value: 'rename', label: 'Choose a different name' },
          { value: 'cancel', label: 'Cancel' },
        ],
      });
      if (p.isCancel(action) || action === 'cancel') {
        p.cancel('Aborted. No changes made.');
        return false;
      }
      if (action === 'rename') continue;
      // override
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
