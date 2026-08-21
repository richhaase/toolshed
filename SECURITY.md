# Security

Toolshed distributes Agent Skills plugins to Claude Code and Codex. Skills
ship as Markdown plus optional Bash and Node.js scripts that execute on the user's
machine when the plugin is installed and a skill is invoked.

## What runs on your machine

- `plugins/<name>/skills/<skill>/SKILL.md` is markdown read by the agent —
  no execution.
- `plugins/<name>/skills/<skill>/scripts/` and
  `plugins/<name>/skills/_shared/scripts/` may contain Bash or dependency-free
  Node.js programs that the agent invokes. Read them before installing a plugin.
- `plugins/memento/` reads and writes files inside the resolved Memento
  root and may invoke `git` against that root.
- `plugins/actuary/` is read-only by design; it reads skill files and may use
  local shell utilities to measure or grep them.

Bundled helper scripts do not make network requests on their own. Skill
workflows can direct the host agent to use tools it already has (for example,
`gh`, `curl`, or a web tool); review the skill instructions and allowed tools
before invoking one.

## Reporting issues

For non-sensitive issues, open a GitHub issue at
<https://github.com/richhaase/toolshed/issues>. For anything that warrants
private disclosure, reach the maintainer via the contact info on
<https://github.com/richhaase>.
