import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as p from '@clack/prompts';

const CONFIG_PATH = join(homedir(), '.cclink.json');

export interface CclinkConfig {
  rootPath: string;
  activeAccount?: string;
}

export function readConfig(): CclinkConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.rootPath !== 'string') return null;
    return parsed as CclinkConfig;
  } catch {
    return null;
  }
}

export function writeConfig(config: CclinkConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

export function requireConfig(): CclinkConfig {
  const config = readConfig();
  if (!config) {
    p.log.error('cclink is not configured. Run `cclink setup --path <path>` first.');
    process.exit(1);
  }
  return config;
}
