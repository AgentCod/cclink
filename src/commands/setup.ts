import * as p from '@clack/prompts';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { readConfig, writeConfig } from '../lib/config.js';

export async function setupCommand(rawPath: string): Promise<void> {
  p.intro('cclink setup');

  // Expand leading ~ to home directory (handles both '~' and '~/...')
  const expandedPath = rawPath === '~' || rawPath.startsWith('~/')
    ? rawPath.replace(/^~/, homedir())
    : rawPath;

  const resolvedPath = resolve(expandedPath);

  // Reject paths inside ~/.claude (check with trailing slash to avoid matching ~/.claude-other)
  const claudeDir = `${homedir()}/.claude`;
  if (resolvedPath === claudeDir || resolvedPath.startsWith(claudeDir + '/')) {
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
