# claude-acc

Manage multiple Claude Code accounts via symlinks.

`claude-acc` lets you keep several independent `~/.claude` profiles (each with its own login, history, MCP servers, and settings) and switch between them instantly by swapping a symlink.

## Requirements

- Node.js >= 18
- [Claude Code](https://docs.claude.com/en/docs/claude-code) installed (`claude` on your `PATH`)

## Installation

```bash
npm i -g claude-acc
```

After installation, the `claude-acc` command will be available globally.

## Quick start

```bash
# 1. Choose where account data will live (one-time)
claude-acc setup --path /absolute/path/to/claude-acc-store

# 2. Create your first account and log in
claude-acc login work

# 3. Create another account
claude-acc login personal

# 4. Switch between accounts
claude-acc switch work
claude-acc switch personal

# 5. See current status / list accounts
claude-acc status
```

## How it works

Each account is a directory under your storage path (e.g. `/claude-acc-store/work`, `/claude-acc-store/personal`). `claude-acc` points `~/.claude` at the active account via a symlink, so Claude Code transparently reads and writes to that account's data. Switching is atomic — just re-point the symlink.

On first `setup`, if `~/.claude` already exists as a real directory, `claude-acc` will back it up (or ask before overriding) so no existing data is lost.

## Commands

| Command | Description |
| --- | --- |
| `claude-acc setup --path <path>` | Configure the root storage path where account data is kept. Run once. |
| `claude-acc login <name>` | Create a new account, link `~/.claude` to it, then run `claude login`. |
| `claude-acc switch <name>` | Switch the active account (account must already exist via `login`). |
| `claude-acc status` | Show the active account and list all accounts. |
| `claude-acc list` | Alias for `status`. |
| `claude-acc disable` | Remove the symlink so Claude Code runs against the real `~/.claude` again. |

Run `claude-acc --help` or `claude-acc <command> --help` for full option details.

## Typical workflow

```bash
claude-acc setup --path ~/claude-acc-accounts
claude-acc login work        # prompts claude login for work account
claude-acc login personal    # prompts claude login for personal account
claude-acc status            # shows which one is active

# Later, jump between them:
claude-acc switch work
claude                   # runs as work account

claude-acc switch personal
claude                   # runs as personal account
```

## Uninstall

```bash
claude-acc disable   # restore plain ~/.claude
npm uninstall -g claude-acc
```

Account data under your storage path is not removed — delete it manually if you no longer need it.

## License

[MIT](LICENSE)
