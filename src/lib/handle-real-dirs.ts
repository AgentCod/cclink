import * as p from '@clack/prompts';
import { readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { countFiles, dirExists, getPathStatus, moveToDirWithProgress, removeSymlink } from './symlink.js';
import { isValidAccountName } from './validate.js';

const HOME = homedir();
const CLAUDE_DIR = join(HOME, '.claude');
const CLAUDE_JSON = join(HOME, '.claude.json');
const TARGETS = [CLAUDE_DIR, CLAUDE_JSON];

function isDirEmpty(dirPath: string): boolean {
  try {
    return readdirSync(dirPath).length === 0;
  } catch {
    return true;
  }
}

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
    realItems.push(target);
  }

  if (realItems.length === 0) return true;

  p.log.warn('Found existing real directories/files that need to be backed up:');
  for (const item of realItems) {
    p.log.message(`  ${item}`);
  }

  const choice = await p.select({
    message: 'What would you like to do?',
    options: [
      { value: 'backup', label: 'Backup to a named account folder' },
      { value: 'skip', label: 'Continue without backup (DELETE existing data)' },
      { value: 'cancel', label: 'Cancel — make no changes' },
    ],
  });

  if (p.isCancel(choice) || choice === 'cancel') {
    p.cancel('Aborted. No changes made.');
    return false;
  }

  if (choice === 'skip') {
    const confirm = await p.confirm({
      message: `This will PERMANENTLY DELETE the following. Are you sure?\n  ${realItems.join('\n  ')}`,
      initialValue: false,
    });
    if (p.isCancel(confirm) || !confirm) {
      p.cancel('Aborted. No changes made.');
      return false;
    }
    for (const item of realItems) {
      rmSync(item, { recursive: true, force: true });
    }
    p.log.success('Existing data removed.');
    return true;
  }

  // Get backup name
  let backupName = '';
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
    if (dirExists(backupDir) && !isDirEmpty(backupDir)) {
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
    }

    backupName = name;
    break;
  }

  const backupDir = join(rootPath, backupName);

  // Count total files for progress display
  let totalFiles = 0;
  for (const item of realItems) {
    totalFiles += countFiles(item);
  }

  const s = p.spinner();
  let copiedSoFar = 0;
  const fmt = () => totalFiles > 0 ? `${copiedSoFar} / ${totalFiles} files` : '';

  s.start(`Backing up... (${fmt()})`);

  for (const item of realItems) {
    const itemName = item.split('/').pop()!;
    const baseCount = copiedSoFar;

    moveToDirWithProgress(item, backupDir, (fileCopied) => {
      copiedSoFar = baseCount + fileCopied;
      s.message(`Copying ${itemName} ... (${fmt()})`);
    });

    // If rename was used (no progress callback fired), sync count manually
    copiedSoFar = baseCount + countFiles(join(backupDir, itemName));
    s.message(`Copied ${itemName} (${fmt()})`);
  }

  s.stop(`Backed up to ${backupDir} (${totalFiles} files)`);
  return true;
}
