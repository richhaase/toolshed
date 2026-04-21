---
name: watch
description: >
  Keep an eye on every dispatched legate session in the background — periodically
  sweep `@legate-managed` tmux windows and speak up only when something has
  actually changed. Use when the user says "watch my legates", "keep an eye on
  the dispatched sessions", "watch-legates", "monitor the loops", or otherwise
  wants passive monitoring of running legates without having to ask "how's it
  going" on every turn. To stop: say "stop watching" and the model exits `/loop`.
argument-hint: "[interval]"
allowed-tools:
  - Bash
  - Skill
---

# Watch

Runs in the **main conversation** (not a dispatched legate). Wraps `/loop` +
`legate:debrief` with delta-only reporting so the watcher is silent when
nothing has changed and speaks up when a window's tail shifts, a new legate
appears, or one disappears.

This is the opposite of `legate:debrief all` on demand — `debrief` reports
everything every time; `watch` reports *only* changes, then goes quiet again.

## Arguments

- `(none)` — default interval of 15 minutes.
- `<interval>` — `/loop`-style interval (e.g. `10m`, `30m`, `1h`).

## Procedure

### Step 1: Decide whether this is a fresh invocation or a `/loop` tick

Look back in your conversation history for prior output from this skill. If
none exists, this is a fresh invocation — proceed to Step 2. If prior watch
output exists (the hash snapshot block described in Step 4), this is a tick —
skip to Step 3.

### Step 2: Set up the loop (fresh invocation only)

On fresh invocation, start the loop by running `/loop <interval> /legate:watch`
(default `15m`). Do the first tick immediately (continue to Step 3); the loop
machinery will fire subsequent ticks at the interval.

Tell the user the loop is running, the interval, and the phrase to stop
watching ("stop watching").

### Step 3: Collect current state

Enumerate every `@legate-managed` window and hash its tail:

```bash
for w in $(tmux list-windows -F '#{window_name}'); do
  managed=$(tmux show-option -wv -t "$w" @legate-managed 2>/dev/null)
  if [ "$managed" = "true" ]; then
    hash=$(tmux capture-pane -t "$w" -p -S -20 2>/dev/null | shasum -a 1 | cut -c1-8)
    desc=$(tmux show-option -wv -t "$w" @legate-description 2>/dev/null)
    echo "$w|$hash|$desc"
  fi
done
```

`tmux capture-pane -S -20` reads the last 20 lines of each pane. That window
is wide enough to catch the agent's most recent substantive output block but
narrow enough that intermediate tool scrolling usually doesn't trip the hash.

### Step 4: Compare against the prior tick's hashes

Find your most recent prior tick in conversation history. It will contain a
hash snapshot block in this exact format (set by Step 5):

```
<!-- legate:watch hashes -->
- <window>|<hash>|<description>
- <window>|<hash>|<description>
```

Compute three diffs against the current state:

- **Appeared** — windows present now, absent then.
- **Disappeared** — windows present then, absent now.
- **Changed** — windows present in both, hash different.

Unchanged windows are not interesting. **If all three diffs are empty, report
nothing** — proceed directly to Step 5 and record the new snapshot silently.

### Step 5: Report deltas (only when there are any) and record the new snapshot

If any diff is non-empty, print a short section for each changed window. Use
`legate:debrief` via the Skill tool to synthesize a status line for changed
and appeared windows (debrief already knows how to interpret a pane tail
against a brief). For disappeared windows, just note the name and that the
window is gone.

Keep each window's report to one or two lines. The user wants the arc, not a
transcript.

Whether or not you reported deltas, emit the new hash snapshot so the next
tick has state to compare against. Use this exact format:

```
<!-- legate:watch hashes -->
- <window>|<hash>|<description>
- <window>|<hash>|<description>
```

### Step 6: Sleep until the next tick

`/loop` handles the wake-up schedule. Do not call `ScheduleWakeup` directly
and do not sleep in Bash. Simply end your turn; `/loop` will re-fire you at
the interval.

## Stopping

The user stops watching by saying "stop watching", "cancel the watcher",
"enough watching", or similar. When you detect that intent in a user message
during a tick, exit `/loop` (do not schedule the next wake) and confirm the
watcher is off.

There is no tmux window to kill — `watch` runs in the main conversation.
Re-invoking the skill later starts a fresh loop.

## Scope

- Sweeps **every** `@legate-managed` window regardless of source — `sync-loop`,
  `auto-review-loop`, per-PR reviewer legates, ad-hoc dispatches. No filter
  flag; reviewer-legate outcomes (especially `--request-changes` or errors)
  are exactly what the watcher exists to surface.
- Cross-skill reads go through the Skill tool. `watch` invokes
  `legate:debrief` via Skill for synthesizing changed-window status. It does
  not read debrief's files or scripts, even though they share a plugin.
- Only reads tmux state and its own prior conversation history. No external
  state file.
