# toolshed

A Claude Code plugin marketplace. Install plugins to extend Claude Code with new skills and capabilities.

## Installation

### Add the marketplace

**CLI:**
```bash
claude plugin marketplace add richhaase/toolshed
```

**Inside Claude Code:**
```
/plugin marketplace add richhaase/toolshed
```

Or run `/plugin`, navigate to the **Marketplaces** tab, select "Add new marketplace", and enter `richhaase/toolshed`.

### Install a plugin

**CLI:**
```bash
claude plugin install legate@toolshed
```

**Inside Claude Code:**
```
/plugin install legate@toolshed
```

Or run `/plugin`, go to the **Discover** tab, and select the plugin to install.

You can scope installations with `--scope user` (default, all projects), `--scope project` (shared via `.claude/settings.json`), or `--scope local` (private to you in that repo).

## Plugins

### [Legate](plugins/legate/) — Tmux Session Management

Delegated authority over tmux sessions. Dispatch Claude Code agents to work in parallel, check on their progress, or open a shell alongside them to look around yourself. Stateless by design — tmux is the source of truth.

## License

[MIT](LICENSE)
