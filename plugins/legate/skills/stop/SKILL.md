---
name: stop
description: >
  Stop or cancel delegated Legate work running in a tmux window. Use when the
  user says "stop that session", "cancel the delegated task", "kill the
  worker", or otherwise wants delegated work to stop. This is different from
  "stop watching", which is handled by `watch` and only disables status
  notifications.
argument-hint: "<handle|all>"
allowed-tools: Bash
---

# Stop

Stop delegated work running in a tmux window. Default to a graceful interrupt;
do not kill the window unless the user explicitly asks for deletion.

Read `../_shared/references/conventions.md` before acting.

## Procedure

1. Resolve the target handle (or sweep `@legate-managed` windows for `all`).
2. Send a graceful interrupt:
   ```bash
   tmux send-keys -t "<name>" C-c
   ```
3. Capture the pane tail and confirm the agent stopped.
4. Only delete the window if the user explicitly asked:
   ```bash
   tmux kill-window -t "<name>"
   ```

Leaving the window alive lets the user re-attach and inspect what the agent
was doing before the interrupt.
