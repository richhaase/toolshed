# Toolshed

Toolshed is a multi-harness distribution repo for portable Agent Skills.

## Structure

- `.claude-plugin/` contains Claude Code marketplace metadata.
- `.agents/plugins/` contains Codex marketplace metadata.
- `plugins/<name>/skills/` contains the canonical portable skill bodies.
- `plugins/<name>/.claude-plugin/` and `plugins/<name>/.codex-plugin/` contain
  harness-specific plugin manifests.

## Development Rules

- Keep `memento` and `legate` as separate plugins in the same distribution repo.
- Treat `SKILL.md` files as the canonical workflow source across all harnesses.
- Keep harness-specific wrappers thin. They should route to the portable skill
  body, not duplicate the workflow.
- For repos that use the Memento plugin, `AGENTS.md` is the canonical shared Memento
  context. `CLAUDE.md` should be a thin harness entrypoint that routes to it.
- When changing plugin metadata, update the Claude and Codex manifests together.
- Use ASCII in manifests and docs.
