---
name: dispatch
description: >
  Launch a new tmux window with an AI agent session for a task, or send
  additional instructions to an existing dispatched session. Supports Claude
  Code and Codex — defaults to launching the same agent type as the caller.
  Use when the user wants work done in parallel or outside the current
  conversation: "dispatch", "spin up", "new session", "farm this out", "have
  <agent> handle this", or any reference to a PR, issue, or task they want
  worked on in a separate window. Also handles follow-up orders to an
  existing session (e.g., "send new instructions to the PR session"). Trigger
  whenever parallel or out-of-band work is implied, even if the user doesn't
  say "dispatch."
argument-hint: "<task|PR#|issue> [--codex|--claude]"
allowed-tools:
  - Bash
  - Skill
---

# Dispatch

Send agents out with delegated authority. Launch AI agent sessions in tmux windows
with context, or send additional orders to sessions already running.

Supports two agent runtimes: **Claude Code** and **Codex**.
By default, dispatch launches the same type of agent you are — if you're Claude, you
launch Claude; if you're Codex, you launch Codex. The user can override this by
specifying an agent explicitly (e.g., "dispatch to codex", "have claude handle this").

Tmux is the source of truth. No registry files, no persistent state. Tag windows with
tmux user options so they're discoverable by other legate skills.

## Launching a new session

### Arguments

The user provides a task identifier:
- PR number or ref: `123`, `#123`, `my-org/my-repo#45`
- Issue tracker ticket: `TASK-100` (GitHub Issues, Linear, Jira, etc.)
- Freeform: `"work on the database migration"`

The user may also specify an agent runtime:
- Explicit: `"dispatch to codex"`, `"send this to claude"`
- If not specified, default to your own agent type

### Step 1: Gather context

Based on the input type, gather a concise context brief. The new agent just needs enough
to start working, not a full history.

#### For PRs

Determine the repo. If `owner/repo#number` is given, use that directly. If just a number,
infer from the current git remote:

```bash
git remote get-url origin 2>/dev/null | sed -E 's|.*[:/]([^/]+/[^/.]+)(\.git)?$|\1|'
```

Run these in parallel:
```bash
gh pr view <number> --repo <owner/repo> --json title,body,headRefName,baseRefName,url
gh pr view <number> --repo <owner/repo> --json latestReviews --jq '[.latestReviews[] | {user: .author.login, state: .state}]'
gh api repos/<owner/repo>/pulls/<number>/comments --jq '[.[] | {user: .user.login, path: .path, body: .body}]'
gh api repos/<owner/repo>/pulls/<number>/reviews --jq '[.[] | select(.body != "") | {user: .user.login, state: .state, body: .body}]'
```

Synthesize into a brief that includes:
- PR title and URL
- Branch name
- What reviewers asked for
- What needs to be done

#### For issue tracker tickets

Use whatever tools are available — `gh issue view` for GitHub Issues, Jira MCP, Linear
MCP, etc. Synthesize into a brief.

#### For freeform tasks

Use the description as-is. Add relevant context from the current conversation.

### Step 2: Determine the agent runtime

Resolve which agent to launch:

1. If the user explicitly named an agent ("dispatch to codex", "have claude handle this"),
   use that.
2. Otherwise, default to your own agent type — if you're Claude, launch Claude; if you're
   Codex, launch Codex.

The two supported runtimes and their launcher commands:

| Runtime | Exec command | Context passing | Notes |
|---------|-------------|-----------------|-------|
| `claude` | `exec claude --append-system-prompt "$CONTEXT" -n "<name>"` | Via `--append-system-prompt` flag | Unset `CLAUDECODE` to prevent nested session detection |
| `codex` | `exec codex` | Via kick-off prompt (include context brief in the send-keys message) | Unset `CODEX_*` session env vars if present |

### Step 3: Launch the tmux window

1. Write the context brief to `/tmp/legate-<name>.md` (see format below).

2. Write a launcher script. `exec` replaces the shell so the tmux pane IS the agent
   process.

   **For Claude:**
   ```bash
   WORK_DIR=$(pwd)
   cat > /tmp/legate-<name>.sh <<LAUNCHER
   #!/bin/bash
   cd $WORK_DIR
   unset CLAUDECODE
   CONTEXT=\$(cat /tmp/legate-<name>.md)
   exec claude --append-system-prompt "\$CONTEXT" -n "<name>"
   LAUNCHER
   chmod +x /tmp/legate-<name>.sh
   ```

   **For Codex:**
   ```bash
   WORK_DIR=$(pwd)
   cat > /tmp/legate-<name>.sh <<LAUNCHER
   #!/bin/bash
   cd $WORK_DIR
   exec codex
   LAUNCHER
   chmod +x /tmp/legate-<name>.sh
   ```

3. Check if a window with this name already exists. If it does, append a numeric
   suffix and increment until a free name is found (`pr-123-2`, `pr-123-3`, ...):

   ```bash
   base="<name>"
   name="$base"
   suffix=2
   while tmux list-windows -F '#{window_name}' | grep -q "^${name}$"; do
     name="${base}-${suffix}"
     suffix=$((suffix + 1))
   done
   ```

4. Capture your own pane id — this becomes the `@legate-parent` tag so the new
   `watch` skill knows which children belong to you:

   ```bash
   PARENT_PANE=$(tmux display-message -p -t "$TMUX_PANE" '#{pane_id}')
   ```

   Launch the window and tag it for discoverability:

   ```bash
   tmux new-window -d -n "<name>" "/tmp/legate-<name>.sh"
   tmux set-option -w -t "<name>" @legate-managed true
   tmux set-option -w -t "<name>" @legate-description "<short description of the task>"
   tmux set-option -w -t "<name>" @legate-source "<source identifier, e.g. gh:owner/repo#123>"
   tmux set-option -w -t "<name>" @legate-cwd "$WORK_DIR"
   tmux set-option -w -t "<name>" @legate-agent "<runtime>"
   tmux set-option -w -t "<name>" @legate-parent "$PARENT_PANE"
   ```

   The `@legate-agent` tag records which runtime is in this window (`claude` or
   `codex`). Used by debrief for context. The `@legate-parent` tag scopes
   `watch` sweeps to this parent's own children.

5. Send a kick-off prompt after the agent boots. **Submit the text and the Enter
   keystroke in separate `send-keys` calls with a sleep between them** — otherwise
   the TUI can absorb Enter as part of the bracketed-paste block and the prompt just
   sits in the input box, never submitted:

   ```bash
   sleep 3
   tmux send-keys -t "<name>" "<kick-off prompt>"
   sleep 1
   tmux send-keys -t "<name>" Enter
   ```

   Do NOT collapse this into `tmux send-keys -t "<name>" "<prompt>" Enter` — it works
   for short prompts and silently fails for long ones. Always use two calls.

   **For Claude:** The context brief was already injected via `--append-system-prompt`,
   so the kick-off is just the task instruction.

   **For Codex:** The context brief was NOT injected at launch, so the kick-off must
   include both the context and the task instruction. Prepend the content of
   `/tmp/legate-<name>.md` to the kick-off prompt. Keep it concise — Codex has its
   own context limits.

   Craft the task instruction based on type:
   - **PR review**: `"Review this PR. Read the diff, check the code, and report your findings."`
   - **Issue**: `"Investigate this ticket. Read the relevant code and report what you find."`
   - **Freeform with deliverable**: Use the user's description directly.
   - **Exploratory**: `"Start investigating and report what you find."`

   Incorporate any specific instructions the user gave.

6. **Verify the kick-off actually submitted.** After a brief pause, capture the pane
   and confirm the prompt is no longer sitting in the input box:

   ```bash
   sleep 2
   tmux capture-pane -t "<name>" -p | tail -10
   ```

   If the prompt text still appears next to the `❯` input marker, the Enter didn't
   land. Send another Enter:

   ```bash
   tmux send-keys -t "<name>" Enter
   ```

7. Tell the user which window was created, what agent is running, and what context was
   provided.

8. Arm the watcher. Sleep ~5 seconds first so the kick-off has a moment to
   produce stable boot output — otherwise the very first snapshot captures
   mid-render terminal control sequences and the next tick reports a spurious
   "Changed" delta. Then invoke `legate:watch` via the Skill tool:

   ```bash
   sleep 5
   ```

   This records an initial snapshot of this parent's children and schedules the
   first `ScheduleWakeup` tick. Watching is implicit in dispatch — the user
   doesn't have to ask for it. If a prior "stop watching" opt-out was recorded,
   `watch` clears it on invocation; any new dispatch re-arms the sweep.

## Sending orders to an existing session

When the user wants to send additional instructions to a running session:

1. Resolve which window they mean. Check the conversation context first — you likely
   remember what was dispatched. If ambiguous, list legate-managed windows:

   ```bash
   for w in $(tmux list-windows -F '#{window_name}'); do
     desc=$(tmux show-option -wv -t "$w" @legate-description 2>/dev/null)
     if [ -n "$desc" ]; then
       echo "$w: $desc"
     fi
   done
   ```

2. Send the instruction as two separate calls (text, then Enter) — same reason as
   the kick-off: a combined `send-keys "<text>" Enter` can leave the Enter absorbed
   into the paste, and the instruction sits unsubmitted in the input box:

   ```bash
   tmux send-keys -t "<name>" "<instruction>"
   sleep 1
   tmux send-keys -t "<name>" Enter
   ```

3. Verify submission. After a brief pause, capture the pane and confirm the
   instruction is no longer sitting in the input box:

   ```bash
   sleep 2
   tmux capture-pane -t "<name>" -p | tail -10
   ```

   If the instruction text still appears next to the `❯` input marker, send
   another Enter:

   ```bash
   tmux send-keys -t "<name>" Enter
   ```

4. Confirm to the user what was sent and to which window.

## Context brief format

Keep it under 30 lines. The new agent has full codebase access and can read files
itself — the brief just needs to orient it on *what* to do and *why*, not provide all
the details. A bloated brief wastes system prompt space and buries the signal.

```markdown
# Task: <title>

<URL if applicable>

## What needs to happen
<2-5 bullet points summarizing the work>

## Review feedback (if PR)
<Summarized reviewer comments>

## Key files (if known)
<Files mentioned in review comments or relevant to the task>
```

## Conventions

For the full tag contract and naming conventions shared across all legate skills, see
`../_shared/references/conventions.md`.

## Naming convention

Short, scannable tmux window names:
- PRs: `pr-123`
- Issues: `task-100` (lowercase)
- Freeform: first 2-3 words, kebab-case: `db-migration`

## Brief file lifetime

`/tmp/legate-<name>.md` files persist for the life of the dispatched window
and are read by `debrief` when interpreting pane tails. Stale briefs from
closed sessions are harmless — clean them up opportunistically (e.g.,
`find /tmp -name 'legate-*.md' -mtime +7 -delete` from a shell), or let
the system tmp sweep handle it. `debrief` falls back to
`@legate-description` if the brief is gone.
