---
name: logs
description: >
  Show recent pane output from a delegated Legate tmux window. Use when the
  user asks for logs, transcript, raw output, pane output, recent output, or
  wants more detail than a debrief.
argument-hint: "<handle> [--tail N]"
allowed-tools: Bash
---

# Logs

Show recent pane output without turning it into a full debrief. Prefer concise
tails over huge transcripts unless the user explicitly asks for more.

Read `../_shared/references/conventions.md` before resolving the handle.

## Procedure

1. Resolve the target handle from conversation history, then from tmux
   windows tagged `@legate-managed` if needed.
2. Capture recent pane output:
   ```bash
   tmux capture-pane -t "<name>" -p -S -100
   ```
3. If the user passed `--tail N`, trim to the last N lines after capture.
4. Increase the scrollback (`-S -500`, etc.) only when the user asks for
   older context.

Do not strip or reformat the captured output beyond the tail trim. The point
of `logs` is the raw view; debrief is the place for synthesis.
