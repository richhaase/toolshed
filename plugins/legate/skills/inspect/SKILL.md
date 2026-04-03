---
name: inspect
description: >
  Open a plain terminal pane alongside a dispatched session so the user can look around
  themselves. Use when the user says "let me look at that", "open a shell for", "inspect",
  "I want to poke around", "give me a terminal there", or wants hands-on access to a
  session's workspace without going through the agent. Trigger this skill when the user
  wants direct filesystem or shell access to a dispatched session's environment.
allowed-tools:
  - Bash
---

# Inspect

Open a bare shell pane inside the target session's tmux window so the user can poke around
alongside the agent. No Claude, no extra agent — just a terminal in the right directory,
right next to the work.

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

## Opening the pane

Split the target window to open a shell pane alongside the running agent:

```bash
CWD=$(tmux show-option -wv -t "<source-window>" @legate-cwd 2>/dev/null)
tmux split-window -t "<source-window>" -h -c "${CWD:-$(pwd)}"
```

This opens a horizontal split in the same window where the agent is working, so the
user can see both side by side.

Tell the user the pane is open and where it's pointed.

## Notes

- If the target window no longer exists, tell the user — don't silently fail. Offer to
  open a shell in the last known working directory if the `@legate-cwd` tag is still
  readable from tmux.
- Don't tag inspection panes as `@legate-managed` — they're ephemeral, user-driven,
  and shouldn't show up in debrief sweeps.
- If the user asks to inspect something that wasn't dispatched by legate, just open a
  window in whatever directory makes sense. The skill doesn't need to be rigid about this.
