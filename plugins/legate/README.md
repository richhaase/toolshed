# Legate

Delegated authority over tmux sessions. Legate turns your AI agent session into a command center — dispatch agents to work in parallel, check on their progress, or switch over to interact with them directly.

Supports **Claude Code**, **Codex**, and **Gemini CLI**. By default, dispatch launches the same type of agent as the caller — Claude dispatches Claude, Codex dispatches Codex, etc. Override by specifying an agent explicitly.

Stateless by design. Tmux is the source of truth — window names, tags (`@legate-managed`, `@legate-description`, `@legate-agent`, etc.), and pane contents are the only state. No registry files, no persistent storage. Conversation context provides semantic memory.

## Skills

### dispatch

Launch a new AI agent session in a tmux window with context, or send additional instructions to an existing session.

**Launching a session:**
- Accepts PR numbers (`#123`, `my-org/my-repo#45`), issue tracker tickets (`TASK-100`), or freeform descriptions
- Gathers context automatically — PR details via `gh`, issue info from available tools, or your description as-is
- Opens a tmux window with the selected agent runtime, tagged for discoverability
- Sends a tailored kick-off prompt to get the agent working
- Defaults to your own agent type; override with "dispatch to codex", "have gemini look at this", etc.

**Sending orders to an existing session:**
- Resolves natural references ("the PR session", "that migration task") to the right tmux window
- Sends instructions via `tmux send-keys`

```
dispatch a session for #123
tell the PR session to also run the tests
dispatch a task to investigate the flaky CI
```

### debrief

Check on one or all dispatched sessions and pull status back into the current conversation.

- Captures pane output via `tmux capture-pane`
- Reports what the agent is doing: working, idle, errored, waiting for input
- Can target a single session or sweep all legate-managed windows at once

```
debrief the PR session
how's everything going?
status on all sessions
```

### inspect

Switch focus to a dispatched session's tmux window so you can interact with the agent directly.

- Resolves natural references ("the PR session") to the right window
- Switches your tmux focus there — you're now talking to that agent

```
inspect the migration task
take me to the PR session
```

## Shared sessions

Dispatched sessions are not black boxes. The user can switch to any session and interact
with the agent directly — giving instructions, asking follow-ups, or taking over entirely.
This is a core part of the model: dispatch starts the work, but anyone can pick it up.

When debriefing or otherwise reading pane output, look for user prompt markers (`❯`) to
distinguish between user-driven actions and autonomous agent behavior. Report what happened
factually based on who initiated it.

## How it works

Legate tags each dispatched tmux window with user options:

| Tag | Purpose |
|-----|---------|
| `@legate-managed` | Marks the window as legate-managed |
| `@legate-description` | Short description of the task |
| `@legate-source` | Source identifier (e.g., `gh:owner/repo#123`) |
| `@legate-cwd` | Working directory of the session |
| `@legate-agent` | Agent runtime: `claude`, `codex`, or `gemini` |

These tags let `debrief` and `inspect` discover and interact with sessions without any external state. Named Claude Code sessions (`claude -n <name>`) mean session history persists even if you need to reconnect.

## Installation

```bash
claude plugin install legate@toolshed
```

Or inside Claude Code:

```
/plugin install legate@toolshed
```
