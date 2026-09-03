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
codex plugin add memento@toolshed
codex plugin add actuary@toolshed
codex plugin add steward@toolshed
codex plugin add ostrich@toolshed
```

Codex reads `.agents/plugins/marketplace.json` and each plugin's
`.codex-plugin/plugin.json`.

For local development:

```bash
codex plugin marketplace add /path/to/toolshed
```

## Runtime requirements

The skill instructions themselves are Markdown. Optional bundled helpers use
Node.js (dependency-free JavaScript), Bash, and Git. Install all three to use
the complete Memento workflow and the repository validation/privacy gates.
Memento also expects standard Unix utilities; its health check uses `rg` when
available and falls back to `grep`.

The host agent may use its own configured tools for workflow steps, including
network access described by a skill. Bundled helper scripts do not install
packages or make network requests on their own.

## Plugins

### [Memento](plugins/memento/) — Personal Memory Base

Multi-layer cache memory base with automated compilation. Treats knowledge
like a CPU cache hierarchy: L1 (`AGENTS.md` hot set) -> L2 (wiki, loaded on
demand) -> L3 (sources, cold storage). Claude Code uses a thin `CLAUDE.md`
entrypoint that imports `AGENTS.md`. Includes setup, compilation, read-only
health checks, session capture, active interview, follow-up queue review, and
gated skill/tool promotion.

Memento can be installed globally while the actual wiki lives in one configured
data root. Set `MEMENTO_ROOT=/path/to/memento` or add a `.memento-root` file to
a project repo; the bundled `skills/_shared/scripts/memento-root` and
`skills/_shared/scripts/memento-run` helpers make each skill operate from the
resolved root instead of assuming the current repo is the Memento.

### [Actuary](plugins/actuary/) — Skill Audit

Audit and evaluate Agent Skills against the agentskills.io specification and
authoring best practices. The `skill-audit` skill separates portable L1 spec
compliance from named harness profiles, then reports L2 structure and L3 craft.
With `--tier`, it adds privacy/genericization checks and a static Gate-1 verdict
used by Memento's `promote` flow; final behavioral readiness remains separate.

### [Steward](plugins/steward/) — Intent and Assurance Contracts

Separate software intent and assurance from an interchangeable builder.
`frame` freezes the minimum decision-complete intent delta, `critique`
conditionally challenges material ambiguity without expanding scope, and
`assess` binds proportionate post-build evidence to a frozen contract and
immutable change identity. Any agent, bundled workflow, or human process may
construct the change. The dependency-free CLI preserves local immutable
revisions without a remote ticket store or builder adapter.

### [Ostrich](plugins/ostrich/) — Deliberate Distraction

Break away from overwhelming or unwanted work through one agent-chosen tangent.
Ostrich silently excludes the active work cluster, rolls a tangent from a grid
of domains, formats, and constraints, seeds it from no-key public sources such
as a random newspaper page or a museum object, delivers it as markdown, a
linked image or recording, a playable artifact, or a terminal toy depending on
the harness, and learns broad preferences through a bounded ledger without
retaining the work context that prompted the break.

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
