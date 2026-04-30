---
name: watch
description: >
  Internal sweep-and-report skill for auto-watching dispatched legate children.
  Armed by `legate:dispatch` at launch time and fired on a cadence by
  `ScheduleWakeup`. Sweeps only the children tagged `@legate-parent = <my pane
  id>`, hashes each pane tail, reports deltas via `legate:debrief`, and
  re-schedules the next tick. Also handles user utterances that stop or
  confirm watching: "stop watching", "cancel the watcher", "enough watching",
  "are you still watching?", "watch my legates" (confirmation when children
  exist; a hint to dispatch when none do). Do NOT invoke for "start watching"
  — watching is implicit in dispatch.
argument-hint: "[stop]"
allowed-tools:
  - Bash
  - Skill
  - ScheduleWakeup
---

# Watch

Auto-watcher for dispatched legate children. Runs in the **parent conversation**
(the session that dispatched the children). Tmux is the source of truth — the
parent's pane id identifies it, `@legate-parent` tags identify its children,
and pane-tail hashes detect change.

This skill is not typically user-invoked. `legate:dispatch` invokes it at
launch to record an initial snapshot and schedule the first tick. Subsequent
ticks fire via `ScheduleWakeup` with a sentinel prompt that routes back here.
The only user-facing triggers are stop/confirm utterances (see Step 6).

## Procedure

### Step 1: Identify yourself

Get your own tmux pane id. This is the `@legate-parent` value you sweep on:

```bash
MY_PANE=$(tmux display-message -p -t "$TMUX_PANE" '#{pane_id}')
```

If `$TMUX_PANE` is unset (not running inside tmux), watching is not meaningful
— report that and exit.

### Step 2: Check for opt-out

Look back in conversation history for the most recent snapshot block. If its
header is `<!-- legate:watch hashes opt-out -->`, the user has opted out of
watching. Do not sweep, do not schedule. Exit silently unless this invocation
is a user-driven confirmation check (Step 6).

When `dispatch` invokes this skill, the opt-out is cleared — any new dispatch
re-arms the sweep. Clear the flag by writing the new snapshot with the
non-opt-out header in Step 5.

### Step 3: Sweep your children

Enumerate every window whose `@legate-parent` matches your pane id and hash
the last 20 lines:

```bash
for w in $(tmux list-windows -F '#{window_name}'); do
  parent=$(tmux show-option -wv -t "$w" @legate-parent 2>/dev/null)
  if [ "$parent" = "$MY_PANE" ]; then
    hash=$(tmux capture-pane -t "$w" -p -S -20 2>/dev/null | shasum -a 1 | cut -c1-8)
    desc=$(tmux show-option -wv -t "$w" @legate-description 2>/dev/null)
    echo "$w|$hash|$desc"
  fi
done
```

20 lines is wide enough to catch the agent's most recent substantive output
block and narrow enough that intermediate tool scrolling usually doesn't trip
the hash.

If the sweep finds no children, this parent has nothing to watch. Skip to
Step 5 (record an empty snapshot), do not schedule a wakeup, and exit.

### Step 4: Diff against the prior snapshot

Find the most recent prior snapshot in your conversation history in this
format (set by Step 5):

```
<!-- legate:watch hashes -->
- <window>|<hash>|<description>
- <window>|<hash>|<description>
```

Compute three diffs against the current state:

- **Appeared** — windows present now, absent then (a new dispatch).
- **Disappeared** — windows present then, absent now (child closed).
- **Changed** — windows present in both, hash different (child made progress).

Unchanged windows are not interesting. **If all three diffs are empty, report
nothing.**

If any diff is non-empty, render the **entire** report inside an ASCII box
so it stands out from surrounding model output. See
`references/rendering.md` for the exact shape, the 78-char border rule, the
gutter convention, and the wrap/breathing-room rules. The box is the only
rendering — never print plain-text recaps outside it.

For changed and appeared windows, invoke `legate:debrief <window>` via the
Skill tool to get a one-line synthesis. For disappeared windows, just note
the name.

### Step 5: Record the new snapshot

Whether you reported deltas or not, emit the new snapshot so the next tick
has state to compare against. Use this exact format:

```
<!-- legate:watch hashes -->
- <window>|<hash>|<description>
- <window>|<hash>|<description>
```

Use the opt-out header `<!-- legate:watch hashes opt-out -->` only when Step 6
recorded a stop intent this turn.

### Step 6: Handle user stop/confirm intent

If the current invocation was triggered by a user message (not by `dispatch`
and not by a wakeup sentinel), check the message for intent:

- **Stop** — "stop watching", "cancel the watcher", "enough watching",
  "stop auto-watching", etc. Write the snapshot with the opt-out header. Do
  not schedule the next wakeup. Confirm the watcher is off.
- **Confirm** — "are you still watching?", "watch my legates", "keep an eye
  on them". If children exist, confirm the count and that watching is active.
  If no children exist, tell the user there's nothing to watch yet and suggest
  they dispatch something.

Otherwise (invoked by `dispatch` or a wakeup sentinel), skip this step.

### Step 7: Schedule the next tick

If all of the following hold, schedule the next tick:

- At least one child exists (Step 3 returned non-empty).
- The user did not opt out this turn (Step 6 did not record a stop).
- The parent is not already running inside `/loop` — if it is, `/loop`'s
  cadence drives the ticks and a second scheduler would conflict.

Call:

```
ScheduleWakeup(
  delaySeconds=270,
  reason="legate:watch idle sweep",
  prompt="<!-- legate:watch wakeup --> Run the legate:watch sweep.",
)
```

270s keeps us inside the 5-minute prompt-cache TTL (300s is the worst-of-both
— pays a cache miss without amortizing it). If the user types before the
wakeup fires, their message supersedes the scheduled tick.

If any of the conditions above fails, do not schedule. Watching quiesces
naturally when children are gone or the user opts out.

## Scope

- Sweeps only `@legate-managed` windows whose `@legate-parent` matches this
  parent's pane id. Other parents' children are invisible here; use
  `legate:debrief all` for on-demand cross-parent sweeps.
- Cross-skill reads go through the Skill tool. `watch` invokes
  `legate:debrief` for synthesizing changed-window status. It does not read
  debrief's files or scripts, even though they share a plugin.
- Only reads tmux state and its own prior conversation history. No external
  state file.

## Conventions

See `references/conventions.md` for the full tag contract, parent-identity
semantics, and snapshot block format.
