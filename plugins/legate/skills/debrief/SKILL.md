---
name: debrief
description: >
  Check on dispatched tmux sessions and pull status back into the current conversation.
  Use when the user asks to "check on", "how's it going with", "status of", "debrief",
  "any updates from", "is that done yet", "what's happening with", "report back on",
  or otherwise wants to know what a dispatched session is doing. Can target a specific
  session or sweep all legate-managed sessions. Trigger this skill whenever the user
  asks about the state of work happening in other sessions, even casually.
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

### Know what was asked

Before looking at pane output, read the context brief written at dispatch time:

```bash
cat /tmp/legate-<name>.md 2>/dev/null
```

If the file is gone (reboot, manual cleanup), fall back to the description tag:

```bash
tmux show-option -wv -t "<name>" @legate-description 2>/dev/null
```

Either way, anchor on what the task was — this is the frame for interpreting pane output.

### Capture and read the tail

```bash
tmux capture-pane -t "<name>" -p -S -50
```

The signal is at the bottom. Read the captured output from the last line upward:

1. Skip blank lines, prompt lines, and idle cursors (`❯`, `>`, `$`)
2. Skip tool-call noise — file paths being read, grep results, diff hunks, progress bars
3. Find the agent's last substantive prose block — that's the conclusion or current status
4. Compare it against the original task brief

If 50 lines isn't enough context, capture more — but resist going wider than necessary.
More lines means more noise to sift through.

```bash
tmux capture-pane -t "<name>" -p -S -200
```

## Debriefing all sessions

When the user asks for a sweep ("how's everything going", "status on all sessions"):

1. Find all legate-managed windows and read each context brief:

   ```bash
   for w in $(tmux list-windows -F '#{window_name}'); do
     managed=$(tmux show-option -wv -t "$w" @legate-managed 2>/dev/null)
     if [ "$managed" = "true" ]; then
       agent=$(tmux show-option -wv -t "$w" @legate-agent 2>/dev/null)
       echo "=== $w [$agent] ==="
       echo "--- brief ---"
       cat /tmp/legate-$w.md 2>/dev/null || tmux show-option -wv -t "$w" @legate-description 2>/dev/null
       echo "--- tail ---"
       tmux capture-pane -t "$w" -p -S -20
       echo ""
     fi
   done
   ```

2. For each session, read the tail bottom-up (skip noise, find the conclusion) and compare
   against the brief. Summarize concisely — one or two lines per session. Include which
   agent runtime is running (claude, codex, gemini) so the user knows what's where.

## When a session is gone

If `tmux capture-pane` fails or the window no longer exists, the session has ended or
been closed. Report this clearly — "that session is gone" is a useful status. Check the
`@legate-description` tag if it's still readable to remind the user what it was working on.
Don't treat a missing window as an error in *your* workflow — it's just a fact to report.

## Reporting style

Structure reports around the task arc, not the raw output:

- **What was asked** — one line from the context brief
- **Current state** — working / idle / errored / done
- **Conclusion** (if idle or done) — what the agent concluded or delivered
- **Needs intervention?** — only if something looks stuck or wrong

Be concise. The user wants the arc, not a transcript.

- "pr-123 was asked to address review feedback. Done — applied all three suggestions and pushed. Idle."
- "db-migration was asked to add the new index. Still working — running the test suite."
- "task-100 was asked to investigate the config bug. Errored — can't find the expected config file. Needs a nudge."
