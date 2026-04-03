---
name: debrief
description: >
  Check on dispatched tmux sessions and pull status back into the current conversation.
  Use when the user asks to "check on", "how's it going with", "status of", "debrief",
  or otherwise wants to know what a dispatched session is doing. Can target a specific
  session or sweep all legate-managed sessions.
allowed-tools:
  - Bash
---

# Debrief

Pull status from dispatched sessions back into the current conversation. Tmux is the
source of truth — capture pane output, read window tags, assess what's happening.

## Targeting a session

Resolve which session the user means:

1. **Conversation context first** — you likely remember what was dispatched and can match
   natural references ("the auth PR", "that cleanup task") to window names.

2. **If ambiguous**, list legate-managed windows:

   ```bash
   for w in $(tmux list-windows -F '#{window_name}'); do
     desc=$(tmux show-option -wv -t "$w" @legate-description 2>/dev/null)
     if [ -n "$desc" ]; then
       echo "$w: $desc"
     fi
   done
   ```

3. Ask the user to clarify only if you genuinely can't resolve it.

## Debriefing a single session

Capture recent output from the target window:

```bash
tmux capture-pane -t "<name>" -p -S -50
```

Read the output and report back to the user:
- What the agent appears to be doing (working, waiting for input, idle, errored)
- Key output or findings visible in the pane
- Whether it looks like it needs intervention

If the visible output isn't enough to tell what's going on, you can capture more history:

```bash
tmux capture-pane -t "<name>" -p -S -200
```

## Debriefing all sessions

When the user asks for a sweep ("how's everything going", "status on all sessions"):

1. Find all legate-managed windows:

   ```bash
   for w in $(tmux list-windows -F '#{window_name}'); do
     managed=$(tmux show-option -wv -t "$w" @legate-managed 2>/dev/null)
     if [ "$managed" = "true" ]; then
       desc=$(tmux show-option -wv -t "$w" @legate-description 2>/dev/null)
       echo "--- $w: $desc ---"
       tmux capture-pane -t "$w" -p -S -20
       echo ""
     fi
   done
   ```

2. Summarize each session's status concisely — one or two lines per session.

## Reporting style

Be concise. The user wants to know what's happening, not a transcript. Lead with the
status, follow with details only if relevant:

- "pr-123 is still working — it's running the test suite after applying review feedback."
- "db-migration looks done — it's sitting at an idle prompt. Last thing it did was open a PR."
- "task-100 hit an error — couldn't find the config file it expected."
