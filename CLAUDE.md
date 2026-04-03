# toolshed

Claude Code plugin marketplace. Plugins live in `plugins/`, manifest is `.claude-plugin/marketplace.json`.

Skills follow the [Agent Skills](https://agentskills.io) open format.

## Commands

```bash
claude plugin validate .          # Validate marketplace structure
claude plugin validate plugins/<name>  # Validate a single plugin
```

## Adding a plugin

1. Create `plugins/<name>/` with a `.claude-plugin/plugin.json` manifest
2. Add skills as `skills/<skill-name>/SKILL.md` directories (per [Agent Skills spec](https://agentskills.io/specification))
3. Add an entry to `.claude-plugin/marketplace.json`: `"source": "./<path>"`
4. Validate with `claude plugin validate .`

## Skill format

Each skill is a directory with a `SKILL.md` containing YAML frontmatter + Markdown instructions:
- **Required frontmatter:** `name` (lowercase, hyphens, must match directory name), `description`
- **Optional frontmatter:** `license`, `compatibility`, `metadata`, `allowed-tools`
- **Optional directories:** `scripts/`, `references/`, `assets/`
- Keep `SKILL.md` under 500 lines; move detailed reference material to `references/`

## Current plugins

- **legate** — Stateless tmux session management (dispatch, debrief, inspect). Tmux is the source of truth; no registry files.
