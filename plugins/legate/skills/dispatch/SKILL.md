---
name: dispatch
description: >
  Delegate work to a native agent backend or tmux fallback, or send follow-up
  instructions to an existing delegated handle. Supports Codex native agents,
  Claude Code background agents/subagents, and tmux sessions. Use when the user
  wants work done in parallel or outside the current conversation: "dispatch",
  "spin up", "new session", "farm this out", "have another agent handle this", or any
  PR, issue, or task they want handled separately. Also handles follow-up orders
  to existing delegated work. Trigger whenever parallel or out-of-band work is
  implied, even if the user does not say "dispatch."
argument-hint: "<task|PR#|issue> [--codex-native|--claude-bg|--claude-subagent|--tmux]"
allowed-tools: Bash Skill Agent
---

# Dispatch

Start delegated work, or send a follow-up to work already delegated. Legate is
backend-neutral: native Codex agents, Claude Code background agents/subagents,
and tmux windows are all backends behind the same user-facing command.

Read `../_shared/references/backends.md` when choosing a backend or handling a
backend-specific operation. Read `../_shared/references/conventions.md` for the
handle, naming, and brief formats.

## Procedure

### 1. Resolve intent

Decide whether this is a new dispatch or a follow-up to an existing handle.

- New dispatch: gather context and create a handle.
- Follow-up: resolve the handle from conversation history first, then backend
  discovery if needed.

Ask for clarification only when the target or task cannot be reasonably
inferred.

### 2. Gather a concise brief

For PRs, infer the repository from `owner/repo#number` or the current git
remote, then gather PR metadata, reviews, review comments, and requested work.
Use available tools such as `gh` and connected issue trackers.

For issues or tickets, use the relevant tracker tools when available.

For freeform tasks, use the user's wording plus relevant current-conversation
context. Keep the brief under 30 lines.

### 3. Choose the backend

Use explicit user preference first:

- `--codex-native` or "native Codex agent" -> `codex-native`
- `--claude-bg` or "Claude background agent" -> `claude-bg`
- `--claude-subagent` or "Claude subagent" -> `claude-subagent`
- `--tmux`, "terminal", "window", or "attachable" -> `tmux`

If the user does not choose, use the routing policy in `backends.md`:

- In Codex, prefer `codex-native` for bounded sidecar investigation,
  verification, review, or isolated implementation.
- In Claude Code, prefer `claude-bg` for durable delegated work when available.
- Use Claude subagents for narrow in-session tasks that should return a summary.
- Use `tmux` when native primitives are unavailable, when launching a different
  runtime, or when the user wants a visible terminal session.

### 4. Launch new work

#### Codex native

Use the native agent tool if available.

- Read-only investigation: spawn an `explorer`.
- Implementation: spawn a `worker`, give it explicit file/module ownership, and
  tell it that other agents may also be editing the codebase.
- Ask the agent to return a concise result and, for code edits, list changed
  files.

Record the returned agent id as the handle id.

#### Claude background agent

Use Claude Code background agents when available:

```bash
claude --bg --name "<name>" "<prompt>"
```

Capture the short id printed by Claude and record it as the handle id. If the
user asked for a named subagent as the main background agent, use:

```bash
claude --agent <agent-name> --bg --name "<name>" "<prompt>"
```

#### Claude subagent

Use the Claude Code Agent/Task tool or an explicitly named subagent. Treat this
as scoped delegated work that returns a final summary, not a durable session.
Record a local label as the handle id if the harness does not provide one.

#### Tmux

Use the existing tmux backend when selected or needed:

1. Write the brief to `/tmp/legate-<name>.md`.
2. Launch a tmux window running the selected agent runtime.
3. Tag the window with `@legate-managed`, `@legate-description`,
   `@legate-source`, `@legate-cwd`, `@legate-agent`, and `@legate-parent`.
4. Send the kickoff prompt as text and Enter in separate `tmux send-keys`
   calls, with a short sleep between them.
5. Capture the pane tail and verify the prompt submitted.

For tmux-specific tag details, see `conventions.md`.

### 5. Record the handle

Emit or update the handle block in conversation history:

```text
<!-- legate:handles -->
- <name>|backend=<backend>|id=<backend-id>|cwd=<path>|source=<source>|desc=<description>
```

Then tell the user the name, backend, and short task description. Do not present
attachability as a guarantee; attach is backend-specific.

### 6. Arm watch

Invoke `legate:watch` after dispatch so the parent conversation records an
initial snapshot and schedules the first tick when appropriate.

## Sending follow-up instructions

Resolve the handle and use the backend's send capability:

- `codex-native`: send input to the active agent handle.
- `claude-bg`: if the installed Claude CLI exposes a noninteractive reply
  command, use it. Otherwise say this backend requires `attach` or agent view
  for direct replies.
- `claude-subagent`: follow-up is not supported after the subagent returns.
- `tmux`: send text and Enter as separate `tmux send-keys` calls, then verify
  the pane tail.

Confirm what was sent, or clearly state why the backend cannot accept follow-up
instructions.
