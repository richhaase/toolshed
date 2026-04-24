# toolshed

A multi-harness distribution repo for portable agent tooling.

Toolshed publishes the same Agent Skills to Claude Code, Codex, and Gemini CLI.
The portable skill bodies live under `plugins/<plugin>/skills/`. Claude and Codex
get marketplace metadata; Gemini installs or links the same skill directories
directly.

## Installation

### Claude Code

Add the marketplace:

```bash
claude plugin marketplace add richhaase/toolshed
```

Install a plugin:

```bash
claude plugin install kb@toolshed
claude plugin install legate@toolshed
```

Inside Claude Code, the equivalent commands are:

```text
/plugin marketplace add richhaase/toolshed
/plugin install kb@toolshed
/plugin install legate@toolshed
```

### Codex

Add the marketplace:

```bash
codex plugin marketplace add richhaase/toolshed
```

Codex reads `.agents/plugins/marketplace.json` and each plugin's
`.codex-plugin/plugin.json`.

For local development:

```bash
codex plugin marketplace add /path/to/toolshed
```

### Gemini CLI

Install the portable skills:

```bash
gemini skills install https://github.com/richhaase/toolshed --path plugins/kb/skills
gemini skills install https://github.com/richhaase/toolshed --path plugins/legate/skills
```

For local development:

```bash
gemini skills link /path/to/toolshed/plugins/kb/skills --scope workspace --consent
gemini skills link /path/to/toolshed/plugins/legate/skills --scope workspace --consent
```

## Plugins

### [KB](plugins/kb/) — Personal Knowledge Base

Multi-layer cache knowledge base with automated compilation. Treats knowledge
like a CPU cache hierarchy: L1 (`AGENTS.md` hot set) -> L2 (wiki, loaded on
demand) -> L3 (sources, cold storage). Claude and Gemini use thin entrypoints
that point to `AGENTS.md`. Includes setup, compilation, session capture, task
management, research with recall, and health checks.

### [Legate](plugins/legate/) — Tmux Session Management

Delegated authority over tmux sessions. Dispatch Claude Code, Codex, or Gemini
CLI agents to work in parallel, check on their progress, or open a shell
alongside them. Stateless by design: tmux is the source of truth.

## Distribution layout

| Harness | Marketplace / extension | Plugin manifest | Context |
| --- | --- | --- | --- |
| Claude Code | `.claude-plugin/marketplace.json` | `plugins/*/.claude-plugin/plugin.json` | `CLAUDE.md` |
| Codex | `.agents/plugins/marketplace.json` | `plugins/*/.codex-plugin/plugin.json` | `AGENTS.md` |
| Gemini CLI | `gemini skills install/link --path plugins/*/skills` | n/a | `GEMINI.md` |

Keep plugin behavior in `SKILL.md`; keep wrappers thin. For KB consumer repos,
`AGENTS.md` is the canonical shared context and vendor entrypoints should only
adapt their harness to it.

## License

[MIT](LICENSE)
