---
name: attach
description: >
  Switch the user's tmux focus to a delegated Legate window. Use when the user
  explicitly says "attach", "take me there", "open that session", "switch to
  that window", or legacy "inspect" phrasing.
argument-hint: "<handle>"
allowed-tools: Bash
---

# Attach

Switch the user into the tmux window for a delegated session.

Read `../_shared/references/conventions.md` before resolving the handle.

## Procedure

1. Resolve the target handle from conversation history, then from tmux
   windows tagged `@legate-managed` if needed.
2. Switch focus:
   ```bash
   tmux select-window -t "<name>"
   ```
3. Tell the user which window was selected.

If the current environment cannot take over the terminal safely, print the
exact `tmux select-window` command instead of faking an attach.
