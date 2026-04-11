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

After installation, the `cclink` command will be available globally.

## Quick start

```bash
# 1. Choose where account data will live (one-time)
cclink setup --path /absolute/path/to/cclink-store

# 2. Create your first account and log in
cclink login work

# 3. Create another account
cclink login personal

# 4. Switch between accounts
cclink switch work
cclink switch personal

# 5. See current status / list accounts
cclink status
```

## How it works

Each account is a directory under your storage path (e.g. `/cclink-store/work`, `/cclink-store/personal`). `claude-acc` points `~/.claude` at the active account via a symlink, so Claude Code transparently reads and writes to that account's data. Switching is atomic — just re-point the symlink.

On first `setup`, if `~/.claude` already exists as a real directory, `claude-acc` will back it up (or ask before overriding) so no existing data is lost.

## Commands

| Command | Description |
| --- | --- |
| `cclink setup --path <path>` | Configure the root storage path where account data is kept. Run once. |
| `cclink login <name>` | Create a new account, link `~/.claude` to it, then run `claude login`. |
| `cclink switch <name>` | Switch the active account (account must already exist via `login`). |
| `cclink status` | Show the active account and list all accounts. |
| `cclink list` | Alias for `status`. |
| `cclink disable` | Remove the symlink so Claude Code runs against the real `~/.claude` again. |

Run `cclink --help` or `cclink <command> --help` for full option details.

## Typical workflow

```bash
cclink setup --path ~/cclink-accounts
cclink login work        # prompts claude login for work account
cclink login personal    # prompts claude login for personal account
cclink status            # shows which one is active

# Later, jump between them:
cclink switch work
claude                   # runs as work account

cclink switch personal
claude                   # runs as personal account
```

## Uninstall

```bash
cclink disable   # restore plain ~/.claude
npm uninstall -g claude-acc
```

Account data under your storage path is not removed — delete it manually if you no longer need it.

## License

[MIT](LICENSE)
