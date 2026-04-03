---
name: dispatch
description: >
  Launch a new tmux window with a Claude Code session for a task, or send additional
  instructions to an existing dispatched session. Use when the user says "dispatch",
  "spin up", "new session", "launch a window for", "send instructions to", or references
  a PR, issue, or task they want worked on in a separate window. Also handles follow-up
  orders like "tell that session to also run the tests."
allowed-tools:
  - Bash
  - Agent
---

# Dispatch

Send agents out with delegated authority. Launch new Claude Code sessions in tmux windows
with context, or send additional orders to sessions already running.

Tmux is the source of truth. No registry files, no persistent state. Tag windows with
tmux user options so they're discoverable by other legate skills.

## Launching a new session

### Arguments

The user provides a task identifier:
- PR number or ref: `123`, `#123`, `my-org/my-repo#45`
- Issue tracker ticket: `TASK-100` (GitHub Issues, Linear, Jira, etc.)
- Freeform: `"work on the database migration"`

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

### Step 2: Launch the tmux window

1. Write the context brief to `/tmp/legate-<name>.md` (see format below).

2. Write a launcher script. `unset CLAUDECODE` prevents nested session detection.
   `exec` replaces the shell so the tmux pane IS the claude process.

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

3. Launch the window and tag it for discoverability:

   ```bash
   tmux new-window -d -n "<name>" "/tmp/legate-<name>.sh"
   tmux set-option -w -t "<name>" @legate-managed true
   tmux set-option -w -t "<name>" @legate-description "<short description of the task>"
   tmux set-option -w -t "<name>" @legate-source "<source identifier, e.g. gh:owner/repo#123>"
   tmux set-option -w -t "<name>" @legate-cwd "$WORK_DIR"
   ```

4. Send a kick-off prompt after Claude boots:

   ```bash
   sleep 3
   tmux send-keys -t "<name>" "<kick-off prompt>" Enter
   ```

   Craft the kick-off based on task type:
   - **PR review**: `"Review this PR. Read the diff, check the code, and report your findings."`
   - **Issue**: `"Investigate this ticket. Read the relevant code and report what you find."`
   - **Freeform with deliverable**: Use the user's description directly.
   - **Exploratory**: `"Start investigating and report what you find."`

   Incorporate any specific instructions the user gave.

5. Tell the user which window was created and what context was provided.

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

2. Send the instruction:

   ```bash
   tmux send-keys -t "<name>" "<instruction>" Enter
   ```

3. Confirm to the user what was sent and to which window.

## Context brief format

Keep it under 30 lines. The new agent has full codebase access — just orient it.

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

## Naming convention

Short, scannable tmux window names:
- PRs: `pr-123`
- Issues: `task-100` (lowercase)
- Freeform: first 2-3 words, kebab-case: `db-migration`
