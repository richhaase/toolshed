# Toolshed

Toolshed is a multi-harness distribution repo for portable Agent Skills.

## Structure

- `.claude-plugin/` contains Claude Code marketplace metadata.
- `.agents/plugins/` contains Codex marketplace metadata.
- Gemini CLI consumes the existing `plugins/<name>/skills/` directories through
  `gemini skills install` or `gemini skills link`.
- `plugins/<name>/skills/` contains the canonical portable skill bodies.
- `plugins/<name>/.claude-plugin/` and `plugins/<name>/.codex-plugin/` contain
  harness-specific plugin manifests.

## Development Rules

- Keep `kb` and `legate` as separate plugins in the same distribution repo.
- Treat `SKILL.md` files as the canonical workflow source across all harnesses.
- Keep harness-specific wrappers thin. They should route to the portable skill
  body, not duplicate the workflow.
- For repos that use the KB plugin, `AGENTS.md` is the canonical shared KB
  context. `CLAUDE.md` and `GEMINI.md` should be thin harness entrypoints that
  route to it.
- When changing plugin metadata, update the Claude and Codex manifests plus
  Gemini installation docs together.
- Use ASCII in manifests and docs.
