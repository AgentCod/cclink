import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export interface KeychainEntry {
  service: string;
  account: string;
  password: string;
}

export function findAllClaudeCredentials(): KeychainEntry[] {
  const dump = spawnSync('security', ['dump-keychain'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (dump.status !== 0) return [];

  const entries: KeychainEntry[] = [];
  // Split into blocks per keychain item
  const blocks = dump.stdout.split(/(?=keychain:)/);

  for (const block of blocks) {
    const svceMatch = block.match(/"svce"<blob>="(Claude Code-credentials[^"]*)"/);
    const acctMatch = block.match(/"acct"<blob>="([^"]*)"/);
    if (!svceMatch || !acctMatch) continue;

    const service = svceMatch[1];
    const account = acctMatch[1];

    const result = spawnSync('security', ['find-generic-password', '-s', service, '-a', account, '-w'], {
      encoding: 'utf8',
    });

    if (result.status === 0 && result.stdout.trim()) {
      entries.push({ service, account, password: result.stdout.trim() });
    }
  }

  return entries;
}

export function saveCertFile(certPath: string, entries: KeychainEntry[]): void {
  writeFileSync(certPath, JSON.stringify(entries, null, 2), 'utf8');
}

export function loadCertFile(certPath: string): KeychainEntry[] | null {
  if (!existsSync(certPath)) return null;
  try {
    return JSON.parse(readFileSync(certPath, 'utf8')) as KeychainEntry[];
  } catch {
    return null;
  }
}

export function restoreKeychainEntries(entries: KeychainEntry[]): number {
  let restored = 0;
  for (const entry of entries) {
    const result = spawnSync(
      'security',
      ['add-generic-password', '-s', entry.service, '-a', entry.account, '-w', entry.password, '-U'],
      { encoding: 'utf8' }
    );
    if (result.status === 0) restored++;
  }
  return restored;
}
