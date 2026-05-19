---
name: dispatch
description: >
  Delegate work to a tmux session running an agent runtime, or send follow-up
  instructions to an existing delegated handle. Use when the user wants work
  done in parallel or outside the current conversation: "dispatch", "spin up",
  "new session", "farm this out", "have another agent handle this", or any PR,
  issue, or task they want handled separately. Also handles follow-up orders to
  existing delegated work. Trigger whenever parallel or out-of-band work is
  implied, even if the user does not say "dispatch."
argument-hint: "<task|PR#|issue>"
allowed-tools: Bash Skill
---

# Dispatch

Start delegated work in a tmux window, or send a follow-up to work already
delegated. Each Legate handle is a single tmux window running an agent runtime
(`claude` or `codex`), tagged with Legate metadata so other skills can find it.

Read `../_shared/references/conventions.md` for the handle, naming, brief, and
tmux tag formats.

## Procedure

### 1. Resolve intent

Decide whether this is a new dispatch or a follow-up to an existing handle.

- New dispatch: gather context, pick a name, launch a window.
- Follow-up: resolve the handle from conversation history first, then scan
  tmux windows tagged `@legate-managed` if needed.

Ask for clarification only when the target or task cannot be reasonably
inferred.

### 2. Gather a concise brief

For PRs, infer the repository from `owner/repo#number` or the current git
remote, then gather PR metadata, reviews, review comments, and requested work
using `gh` and any connected issue trackers.

For issues or tickets, use the relevant tracker tools when available.

For freeform tasks, use the user's wording plus relevant current-conversation
context. Keep the brief under 30 lines.

### 3. Launch the tmux window

1. Pick a handle name (see `conventions.md`). If the name already exists, append
   a numeric suffix.
2. Write the brief to `/tmp/legate-<name>.md`.
3. Capture the parent pane id:
   ```bash
   tmux display-message -p -t "$TMUX_PANE" '#{pane_id}'
   ```
4. Launch a new tmux window running the chosen agent runtime (default
   `claude`, or `codex` when the user asks for it).
5. Tag the window:
   ```bash
   tmux set-option -w -t "<name>" @legate-managed yes
   tmux set-option -w -t "<name>" @legate-description "<short desc>"
   tmux set-option -w -t "<name>" @legate-source "<source>"
   tmux set-option -w -t "<name>" @legate-cwd "<cwd>"
   tmux set-option -w -t "<name>" @legate-agent "<claude|codex>"
   tmux set-option -w -t "<name>" @legate-parent "<parent-pane-id>"
   ```
6. Send the kickoff prompt as text and Enter in separate `tmux send-keys`
   calls, with a short sleep between them.
7. Capture the pane tail to verify the prompt submitted.

### 4. Record the handle

Emit the handle block in conversation history:

```text
<!-- legate:handles -->
- <name>|id=<name>|cwd=<path>|source=<source>|desc=<description>
```

Then tell the user the window name and short task description.

### 5. Arm watch

Invoke `legate:watch` after dispatch so the parent conversation records an
initial snapshot and schedules the first tick.

## Sending follow-up instructions

Resolve the handle, then send text and Enter as separate `tmux send-keys`
calls:

```bash
tmux send-keys -t "<name>" "<follow-up text>"
sleep 0.2
tmux send-keys -t "<name>" Enter
```

Capture the pane tail and confirm what was sent.
