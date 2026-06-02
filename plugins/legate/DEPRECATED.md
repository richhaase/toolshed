# Legate is deprecated

**Status:** Retired 2026-06-02. Code retained for reference and history; not
installable from the toolshed marketplace.

## Why

Legate existed to coordinate delegated agent work over `tmux` — dispatch into a
window, watch for state changes, debrief results, attach to take over. tmux was
never the point; it was the substrate that made independent, attachable,
session-surviving agents possible before any runtime offered them natively.

Claude Code's native **agents view** now provides that substrate directly:
sessions are listed, viewable, and resumable, with worktree isolation and
background completion notifications built in. That subsumes `watch`, `logs`,
`debrief`, and most of `attach`/survivability. The only capability Legate still
held uniquely was cross-runtime (`codex`) dispatch — too thin to justify a
six-skill plugin built around a tmux watch loop.

## What to use instead

- **Parallel / background work:** Claude Code's native agents view + background
  agents (spawn, monitor, resume).
- **Deterministic fan-out:** the Workflow tool.
- **codex dispatch:** launch `codex` in a terminal directly; the orchestration
  layer is no longer worth maintaining for that one thread.

## Marketplace state

- Codex (`.agents/plugins/marketplace.json`): `policy.installation: NOT_AVAILABLE`.
- Claude Code (`.claude-plugin/marketplace.json`): description marked `[DEPRECATED]`
  (Claude's marketplace schema has no install-policy field).

The plugin directory and git history remain intact. To revive, restore the
marketplace policy/description and bump the version.
