import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ClaudeAccountInfo {
  email: string;
  billingType: string;
  subscribedAt: string; // formatted date string or '—'
}

export function readClaudeInfo(accountDir: string): ClaudeAccountInfo {
  const filePath = join(accountDir, '.claude.json');
  const fallback: ClaudeAccountInfo = { email: '—', billingType: '—', subscribedAt: '—' };

  if (!existsSync(filePath)) return fallback;

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    const oauth = raw?.oauthAccount;
    if (!oauth) return fallback;

    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return {
      email: oauth.emailAddress ?? '—',
      billingType: oauth.billingType ?? '—',
      subscribedAt: oauth.subscriptionCreatedAt
        ? formatter.format(new Date(oauth.subscriptionCreatedAt))
        : '—',
    };
  } catch {
    return fallback;
  }
}
