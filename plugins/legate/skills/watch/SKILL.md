---
name: watch
description: >
  Auto-watch delegated Legate work and surface meaningful changes: new handles,
  completions, failures, needs-input states, or changed tmux pane tails. Armed
  by `legate:dispatch` and fired on a cadence by `ScheduleWakeup`. Also handles
  user utterances that stop or confirm watching: "stop watching", "cancel the
  watcher", "enough watching", "are you still watching?", "watch my legates".
  Do NOT invoke for "start watching"; watching is implicit in dispatch.
argument-hint: "[stop]"
allowed-tools: Bash Skill Agent ScheduleWakeup
---

# Watch

Watch delegated work from the parent conversation. The watcher compares a small
backend-neutral snapshot across ticks and reports only meaningful deltas.

Read `../_shared/references/backends.md` for backend status surfaces,
`../_shared/references/conventions.md` for snapshot format, and
`references/rendering.md` before rendering a delta report.

## Procedure

### 1. Check opt-out

Look back for the most recent snapshot block. If it starts with:

```text
<!-- legate:watch snapshot opt-out -->
```

the user has opted out. Do not sweep or schedule unless the current message is
an explicit confirmation request.

Accept the legacy tmux-only `<!-- legate:watch hashes opt-out -->` as opt-out
too.

### 2. Build the current snapshot

Resolve known handles from conversation history and backend discovery.

For each handle, produce:

```text
- <name>|backend=<backend>|state=<state-or-hash>|desc=<description>
```

Backend-specific state:

- `codex-native`: latest native agent state if available, otherwise `working`,
  `done`, `failed`, or `unknown` from the parent handle.
- `claude-bg`: lightweight state from `~/.claude/jobs/<id>/state.json` when
  present, respecting `CLAUDE_CONFIG_DIR`; otherwise a short hash of
  `claude logs <id>` tail.
- `claude-subagent`: `done` once a final summary has returned; otherwise
  `working` or `unknown`.
- `tmux`: hash the last 20 pane lines, preserving the old pane-tail behavior.

If there are no handles, record an empty snapshot, do not schedule, and exit.

### 3. Diff against the prior snapshot

Compute:

- **Appeared** - present now, absent before.
- **Disappeared** - present before, absent now.
- **Changed** - present in both with different state.

Unchanged handles are not interesting. If no diff exists, report nothing.

For appeared and changed handles, invoke `legate:debrief <handle>` through the
Skill tool to get a one-line synthesis. For disappeared handles, just note the
name and backend.

Render any report entirely inside the ASCII box described in
`references/rendering.md`. Do not print extra watch narration outside the box.

### 4. Record the snapshot

Always emit the new snapshot:

```text
<!-- legate:watch snapshot -->
- <name>|backend=<backend>|state=<state-or-hash>|desc=<description>
```

Use the opt-out header only when the user stopped watching this turn.

### 5. Handle user stop/confirm intent

For user-driven messages:

- Stop intent: record the snapshot with the opt-out header, do not schedule,
  and confirm the watcher is off.
- Confirm intent: if handles exist, confirm the count and that watching is
  active. If none exist, say there is nothing to watch yet.

Skip this step for dispatch-triggered or wakeup-triggered runs.

### 6. Schedule the next tick

If at least one handle exists and the user did not opt out, schedule:

```text
ScheduleWakeup(
  delaySeconds=270,
  reason="legate:watch idle sweep",
  prompt="<!-- legate:watch wakeup --> Run the legate:watch sweep.",
)
```

Do not schedule a second watcher if the parent is already in a loop mechanism
that will run watch ticks.

## Scope

Watch is an attention filter, not a transcript reader. It notices state
changes, invokes `debrief` for synthesis, records the next snapshot, and
quiesces when no delegated work remains.
