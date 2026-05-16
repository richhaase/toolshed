---
name: stop
description: >
  Stop or cancel delegated Legate work. Use when the user says "stop that
  session", "cancel the delegated task", "kill the worker", "shut down the
  background agent", or otherwise wants delegated work to stop. This is
  different from "stop watching", which is handled by `watch` and only disables
  status notifications.
argument-hint: "<handle|all>"
allowed-tools: Bash Agent
---

# Stop

Stop delegated work without pretending every backend has the same lifecycle.
Resolve the handle first, then use the backend's stop operation.

Read `../_shared/references/backends.md` and
`../_shared/references/conventions.md` before acting.

## Backend behavior

### Codex native

Close or cancel the native agent handle when the host provides that operation.
Report whether the agent was stopped or had already completed.

### Claude background agent

Use:

```bash
claude stop <id>
```

Do not delete the session or its worktree unless the user explicitly asks.

### Claude subagent

If the subagent is actively running and the host exposes task cancellation, use
it. Otherwise report that completed subagent work cannot be stopped after the
fact.

### Tmux

Prefer a graceful interrupt first:

```bash
tmux send-keys -t "<name>" C-c
```

Do not kill the window unless the user explicitly asks for deletion.
