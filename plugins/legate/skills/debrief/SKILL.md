---
name: debrief
description: >
  Check on delegated Legate work in tmux windows and pull status or results
  back into the current conversation. Use when the user asks to "check on",
  "how's it going with", "status of", "debrief", "any updates from", "is that
  done yet", "what's happening with", "report back on", or otherwise wants to
  know the state of delegated work. Can target one handle or sweep all known
  handles.
argument-hint: "[handle|all]"
allowed-tools: Bash
---

# Debrief

Bring delegated-work state back into the current conversation by reading the
target tmux window.

Read `../_shared/references/conventions.md` for handle resolution and tmux
tag layout.

## Targeting

Resolve the user's target in this order:

1. Recent conversation context and the `<!-- legate:handles -->` block.
2. Tmux windows tagged with `@legate-managed`:
   ```bash
   tmux list-windows -a -F '#{window_name} #{@legate-managed}' \
     | awk '$2 == "yes" {print $1}'
   ```
3. Ask the user only if the target remains ambiguous.

For "all", sweep every legate-managed window discovered in step 2.

## Reading the window

Read the brief first so you can anchor the pane tail against what was asked:

```bash
cat /tmp/legate-<name>.md 2>/dev/null
```

If the brief file is gone, fall back to the description tag:

```bash
tmux show-option -wv -t "<name>" @legate-description
```

Then capture the pane tail:

```bash
tmux capture-pane -t "<name>" -p -S -50
```

Read from the bottom upward. Skip prompts, tool noise, progress bars, and raw
diffs. Find the last substantive prose block and compare it with the brief.

## Reporting style

Report the task arc, not the raw transcript:

- **Handle** - window name.
- **What was asked** - one concise line.
- **Current state** - working, waiting, done, failed, stopped, or unknown.
- **Result** - conclusion or delivered change, when available.
- **Needs intervention** - only when the session looks blocked or stuck.

Keep each handle to one or two lines in an all-hands sweep.
