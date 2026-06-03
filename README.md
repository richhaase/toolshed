# toolshed

My personal Agent Skills for Claude Code and Codex. Treat it like
dotfiles: I update it when I choose, breaking changes are normal, and
there are no stability or compatibility promises. You're welcome to
clone it, fork it, install plugins, or copy any piece into your own
setup — just don't expect anything in here to stay still.

The portable skill bodies live under `plugins/<plugin>/skills/`. Each
harness loads them through its own marketplace metadata.

## Installation

### Claude Code

Add the marketplace:

```bash
claude plugin marketplace add richhaase/toolshed
```

Install a plugin:

```bash
claude plugin install memento@toolshed
```

Inside Claude Code, the equivalent commands are:

```text
/plugin marketplace add richhaase/toolshed
/plugin install memento@toolshed
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

## Plugins

### [Memento](plugins/memento/) — Personal Memory Base

Multi-layer cache memory base with automated compilation. Treats knowledge
like a CPU cache hierarchy: L1 (`AGENTS.md` hot set) -> L2 (wiki, loaded on
demand) -> L3 (sources, cold storage). Claude Code uses a thin `CLAUDE.md`
entrypoint that points to `AGENTS.md`. Includes setup, compilation, read-only
health checks, session capture, active interview, follow-up queue review, and
gated skill/tool promotion.

Memento can be installed globally while the actual wiki lives in one configured
data root. Set `MEMENTO_ROOT=/path/to/memento` or add a `.memento-root` file to
a project repo; the bundled `skills/_shared/scripts/memento-root` and
`skills/_shared/scripts/memento-run` helpers make each skill operate from the
resolved root instead of assuming the current repo is the Memento.

### [Actuary](plugins/actuary/) — Skill Audit

Audit and evaluate Agent Skills against the agentskills.io specification and
authoring best practices. The `skill-audit` skill produces a layered L1 spec /
L2 structural / L3 craft report. With `--tier`, it adds privacy/genericization
checks and a promotion-readiness verdict used by Memento's `promote` flow.

### [Legate](plugins/legate/) — Delegated Work Orchestration _(deprecated)_

> **⚠️ DEPRECATED (2026-06-02)** — superseded by Claude Code's native agents
> view (session list + resume + worktree isolation + background notifications).
> Not installable from the marketplace; code retained for reference. See
> [`plugins/legate/DEPRECATED.md`](plugins/legate/DEPRECATED.md).

Legacy delegated work orchestration for agent sessions. It dispatched Claude
Code or Codex work into tagged tmux windows and provided debrief/watch/logs/stop
helpers. New work should use harness-native background agents / agents view.

## Distribution layout

| Harness | Marketplace metadata | Plugin manifest | Context |
| --- | --- | --- | --- |
| Claude Code | `.claude-plugin/marketplace.json` | `plugins/*/.claude-plugin/plugin.json` | `CLAUDE.md` |
| Codex | `.agents/plugins/marketplace.json` | `plugins/*/.codex-plugin/plugin.json` | `AGENTS.md` |

Keep plugin behavior in `SKILL.md`; keep wrappers thin. For Memento consumer repos,
`AGENTS.md` is the canonical shared context and vendor entrypoints should only
adapt their harness to it.

## License

[MIT](LICENSE)
