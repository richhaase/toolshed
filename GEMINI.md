# Toolshed

Toolshed is a multi-harness distribution repo for portable Agent Skills.

The canonical skill bodies live under `plugins/<plugin>/skills/<skill>/SKILL.md`.
Use those files as the source of truth. Harness-specific manifests and install
docs only expose the same portable resources to Claude Code, Codex, and Gemini CLI.

## Plugins

- `memento` provides local memory-base workflows: setup, recall, remember,
  correct, compile, finish session, tasks, research, and health checks. `kb`
  remains a deprecated compatibility alias.
- `legate` provides tmux-based delegated agent session management: dispatch,
  debrief, and inspect.

## Gemini usage

Install or link the existing skill directories:

```bash
gemini skills link plugins/memento/skills --scope workspace --consent
gemini skills link plugins/legate/skills --scope workspace --consent
```
