# Security

Toolshed distributes Agent Skills plugins to Claude Code and Codex. Skills
ship as markdown plus optional bash scripts that execute on the user's
machine when the plugin is installed and a skill is invoked.

## What runs on your machine

- `plugins/<name>/skills/<skill>/SKILL.md` is markdown read by the agent —
  no execution.
- `plugins/<name>/skills/<skill>/scripts/` and
  `plugins/<name>/skills/_shared/scripts/` are shell scripts that the
  agent may invoke via Bash. Read them before installing a plugin.
- `plugins/legate/` interacts with `tmux`, `gh`, and `git`.
- `plugins/memento/` reads and writes files inside the resolved Memento
  root and may invoke `git` against that root.

Neither plugin has network access of its own; any network calls go through
tools the agent already has (e.g., `gh`, `curl` if a skill writes to it).

## Reporting issues

For non-sensitive issues, open a GitHub issue at
<https://github.com/richhaase/toolshed/issues>. For anything that warrants
private disclosure, reach the maintainer via the contact info on
<https://github.com/richhaase>.
