---
name: inspect
description: >
  Switch focus to a dispatched session's tmux window so the user can interact with the
  agent directly. Use when the user says "let me look at that", "take me there", "inspect",
  "show me that session", "switch to the PR window", or wants to go see what a dispatched
  agent is doing firsthand. Trigger this skill when the user wants to navigate to a
  dispatched session, even if they phrase it casually.
argument-hint: "<session-name>"
allowed-tools:
  - Bash
---

# Inspect

Switch the user's tmux focus to a dispatched session's window so they can interact with
the agent directly. That's it — just take them there.

## Resolving the target

1. **Conversation context first** — match the user's natural reference to a known window.

2. **If ambiguous**, check legate-managed windows:

   ```bash
   for w in $(tmux list-windows -F '#{window_name}'); do
     desc=$(tmux show-option -wv -t "$w" @legate-description 2>/dev/null)
     if [ -n "$desc" ]; then
       echo "$w: $desc"
     fi
   done
   ```

3. Ask the user to clarify only if you genuinely can't resolve it.

## Switching focus

Select the target window:

```bash
tmux select-window -t "<name>"
```

Tell the user which window you switched them to and what it's working on.

## Notes

- If the target window no longer exists, tell the user clearly. Don't silently fail.
- If the user asks to inspect something that wasn't dispatched by legate, do your best
  to find the right window by name. The skill doesn't need to be rigid about this.
