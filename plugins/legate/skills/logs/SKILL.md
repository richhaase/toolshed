---
name: logs
description: >
  Show raw or near-raw detail for delegated Legate work when the backend has a
  log surface. Use when the user asks for logs, transcript, raw output, pane
  output, recent output, or wants more detail than a debrief. Works best for
  Claude background agents and tmux sessions; Codex native agents and Claude
  subagents may only expose latest known status or final responses.
argument-hint: "<handle> [--tail N]"
allowed-tools: Bash
---

# Logs

Show backend detail without turning it into a full debrief. Prefer concise tails
over huge transcripts unless the user explicitly asks for more.

Read `../_shared/references/backends.md` and
`../_shared/references/conventions.md` before resolving the handle.

## Backend behavior

### Claude background agent

Use:

```bash
claude logs <id>
```

If the user asked for a tail, limit output after collecting logs.

### Tmux

Capture recent pane output:

```bash
tmux capture-pane -t "<name>" -p -S -100
```

Increase the scrollback only when the user asks for older context.

### Codex native

There is no independent transcript surface. Show the latest known status, final
response, or changed-files summary from the native agent handle.

### Claude subagent

Show the returned summary from the parent conversation. If no summary is
available, say this backend has no durable log surface.
