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
gemini skills link plugins/memento/skills --scope workspace --consent
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

## Editing plugin behavior

When you change anything inside a plugin directory (`plugins/<name>/SKILL.md`,
files under `plugins/<name>/skills/`, scripts, hooks, references, assets),
bump `version` in **both** harness manifests in lockstep:

- `plugins/<name>/.claude-plugin/plugin.json`
- `plugins/<name>/.codex-plugin/plugin.json`

Use the same version string in both files. Claude Code's plugin cache keys
off `.claude-plugin/plugin.json`; Codex keys off `.codex-plugin/plugin.json`.
Without a bump on either side, installed copies keep serving the old skill
bodies after `/plugin update` (Claude) or a Codex marketplace refresh.

If a plugin gains a new harness manifest later, this rule extends to it —
keep all per-harness `plugin.json` versions identical for a given release.

README and LICENSE edits don't need a bump.

## Current plugins

- **memento** — Memory-base workflows (setup, recall, remember, correct, compile, fin, tasks, research, health-check). `kb` remains a deprecated compatibility alias.
- **legate** — Stateless tmux session management (dispatch, debrief, inspect). Tmux is the source of truth; no registry files.

## Portability rules

- Keep `SKILL.md` as the canonical workflow. Do not copy workflow details into
  harness manifests or install docs.
- Treat `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md` as harness-specific entrypoint
  files for the same conceptual context.
- For Memento consumer repos, treat `AGENTS.md` as the canonical shared Memento context.
  `CLAUDE.md` and `GEMINI.md` should be thin harness entrypoints that route to
  it, not duplicated copies of the same Memento state.
- Prefer generic wording in skills: "agent entrypoint" rather than only
  `CLAUDE.md`, unless the instruction is explicitly Claude-specific.
- Keep `memento` and `legate` separate plugins. Memento may use `legate` when installed,
  but must degrade cleanly when it is not.
