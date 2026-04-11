import { Command } from 'commander';
import { setupCommand } from './commands/setup.js';
import { loginCommand } from './commands/login.js';
import { switchCommand } from './commands/switch.js';
import { statusCommand } from './commands/status.js';
import { disableCommand } from './commands/disable.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const program = new Command();
program
  .name('cclink')
  .description('Manage multiple Claude Code accounts via symlinks')
  .version(pkg.version);

program
  .command('setup')
  .description('Configure root storage path for account data')
  .requiredOption('--path <path>', 'Absolute path to store account data')
  .action(async (opts) => {
    await setupCommand(opts.path);
  });

program
  .command('login <account-name>')
  .description('Create account and link ~/.claude, then run claude login')
  .action(async (accountName) => {
    await loginCommand(accountName);
  });

program
  .command('switch <account-name>')
  .description('Switch active account (account must exist via cclink login first)')
  .action(async (accountName) => {
    await switchCommand(accountName);
  });

program
  .command('status')
  .description('List accounts and optionally switch')
  .action(async () => {
    await statusCommand();
  });

program
  .command('list')
  .description('Alias for status')
  .action(async () => {
    await statusCommand();
  });

program
  .command('disable')
  .description('Remove symlinks so Claude Code runs with ~/.claude directly')
  .action(async () => {
    await disableCommand();
  });

program.parse();
