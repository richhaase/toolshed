---
name: attach
description: >
  Attach to delegated work only when the selected backend supports direct user
  control. Use when the user explicitly says "attach", "take me there", "open
  that session", "switch to that window", or legacy "inspect" phrasing. This is
  an optional backend affordance, not part of the portable Legate contract:
  Claude background agents and tmux sessions may support it; Codex native
  agents and Claude subagents do not.
argument-hint: "<handle>"
allowed-tools: Bash
---

# Attach

Attach is an escape hatch for backends with a real user-facing session. If a
backend does not support direct control, say so and point the user to `debrief`,
`logs`, or `dispatch` follow-up instructions.

Read `../_shared/references/backends.md` and
`../_shared/references/conventions.md` before resolving the handle.

## Procedure

1. Resolve the target handle from conversation history or backend discovery.
2. Check the backend capability.
3. Attach only when supported.

## Backend behavior

### Claude background agent

Use:

```bash
claude attach <id>
```

If the current environment cannot take over the terminal safely, tell the user
the exact command instead of faking an attach.

### Tmux

Switch to the tmux window:

```bash
tmux select-window -t "<name>"
```

Tell the user which window was selected.

### Codex native or Claude subagent

No direct attach exists. Explain that this delegated work is mediated through
the parent conversation and offer the portable alternatives:

- `debrief <handle>` for status/result.
- `logs <handle>` for raw detail when available.
- Follow-up dispatch/send instructions if the backend can accept input.
