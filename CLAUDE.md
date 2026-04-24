# toolshed

Multi-harness distribution repo for portable Agent Skills. The same skill bodies
are exposed to Claude Code, Codex, and Gemini CLI through harness-specific
metadata.

Claude Code marketplace metadata lives in `.claude-plugin/marketplace.json`.
Codex marketplace metadata lives in `.agents/plugins/marketplace.json`.
Gemini CLI installs or links the existing skill directories directly.

Skills follow the [Agent Skills](https://agentskills.io) open format.

## Commands

```bash
claude plugin validate .          # Validate marketplace structure
claude plugin validate plugins/<name>  # Validate a single plugin
codex plugin marketplace add .    # Smoke-test Codex marketplace discovery
gemini skills link plugins/kb/skills --scope workspace --consent
```

## Adding a plugin

1. Create `plugins/<name>/` with a `.claude-plugin/plugin.json` manifest
2. Add `.codex-plugin/plugin.json` for Codex
3. Add skills as `skills/<skill-name>/SKILL.md` directories (per [Agent Skills spec](https://agentskills.io/specification))
4. Add entries to `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`
5. Validate each harness surface where the CLI is available

## Skill format

Each skill is a directory with a `SKILL.md` containing YAML frontmatter + Markdown instructions:
- **Required frontmatter:** `name` (lowercase, hyphens, must match directory name), `description`
- **Optional frontmatter:** `license`, `compatibility`, `metadata`, `allowed-tools`
- **Optional directories:** `scripts/`, `references/`, `assets/`
- Keep `SKILL.md` under 500 lines; move detailed reference material to `references/`

## Current plugins

- **kb** — Knowledge-base workflows (setup, compile, fin, tasks, research, health-check).
- **legate** — Stateless tmux session management (dispatch, debrief, inspect). Tmux is the source of truth; no registry files.

## Portability rules

- Keep `SKILL.md` as the canonical workflow. Do not copy workflow details into
  harness manifests or install docs.
- Treat `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md` as harness-specific entrypoint
  files for the same conceptual context.
- For KB consumer repos, treat `AGENTS.md` as the canonical shared KB context.
  `CLAUDE.md` and `GEMINI.md` should be thin harness entrypoints that route to
  it, not duplicated copies of the same KB state.
- Prefer generic wording in skills: "agent entrypoint" rather than only
  `CLAUDE.md`, unless the instruction is explicitly Claude-specific.
- Keep `kb` and `legate` separate plugins. `kb` may use `legate` when installed,
  but must degrade cleanly when it is not.
