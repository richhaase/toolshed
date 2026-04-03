# Legate

Delegated authority over tmux sessions. Legate turns your main Claude Code session into a command center — dispatch agents to work in parallel, check on their progress, or open a shell alongside them to look around yourself.

Stateless by design. Tmux is the source of truth — window names, tags (`@legate-managed`, `@legate-description`, etc.), and pane contents are the only state. No registry files, no persistent storage. Conversation context provides semantic memory.

## Skills

### commission

Establish this session as the legate — your operational partner. Run `/commission` at the start of a session to activate legate mode.

The legate keeps information-gathering and coordination in-session (briefings, PR triage, quick lookups) and dispatches execution work to agents (building code, code reviews, investigations). It uses judgment about what to handle directly versus farm out — but you always have the final word.

```
/commission
```

### dispatch

Launch a new Claude Code session in a tmux window with context, or send additional instructions to an existing session.

**Launching a session:**
- Accepts PR numbers (`#123`, `my-org/my-repo#45`), issue tracker tickets (`TASK-100`), or freeform descriptions
- Gathers context automatically — PR details via `gh`, issue info from available tools, or your description as-is
- Opens a tmux window with a named Claude Code session, tagged for discoverability
- Sends a tailored kick-off prompt to get the agent working

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

Open a bare shell pane alongside a dispatched session so you can poke around the workspace yourself.

- Splits the target session's tmux window horizontally
- Opens a terminal in the same working directory — no Claude, just a shell
- Inspection panes are ephemeral and don't show up in debrief sweeps

```
inspect the migration task
let me look at that PR session
```

## How it works

Legate tags each dispatched tmux window with user options:

| Tag | Purpose |
|-----|---------|
| `@legate-managed` | Marks the window as legate-managed |
| `@legate-description` | Short description of the task |
| `@legate-source` | Source identifier (e.g., `gh:owner/repo#123`) |
| `@legate-cwd` | Working directory of the session |

These tags let `debrief` and `inspect` discover and interact with sessions without any external state. Named Claude Code sessions (`claude -n <name>`) mean session history persists even if you need to reconnect.

## Installation

```bash
claude plugin install legate@toolshed
```

Or inside Claude Code:

```
/plugin install legate@toolshed
```
