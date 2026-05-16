# Legate

Delegated work orchestration for agent sessions. Legate turns the current agent
conversation into a coordinator: dispatch work elsewhere, watch for meaningful
state changes, bring results back, and capture raw logs when the backend has
them.

Supports **Codex** and **Claude Code** through multiple backends:

- `codex-native` for Codex internal explorer/worker agents.
- `claude-bg` for Claude Code background agents.
- `claude-subagent` for scoped Claude subagent work.
- `tmux` as the visible terminal-session compatibility backend.

Tmux is no longer the conceptual model. It remains a useful backend when the
user wants an attachable terminal session or when native dispatch primitives
are unavailable.

Legate is intentionally adjacent to Memento rather than merged into it:
Legate runs delegated work; Memento preserves useful outcomes, decisions, and
follow-ups.

## Skills

### dispatch

Delegate work to a native agent backend or tmux fallback, or send follow-up
instructions to an existing delegated handle.

**Launching work:**
- Accepts PR numbers (`#123`, `my-org/my-repo#45`), issue tracker tickets
  (`TASK-100`), or freeform descriptions.
- Gathers concise context: PR details via `gh`, issue info from available
  tools, or the current conversation.
- Chooses the best backend unless the user specifies one.
- Records a handle so later skills can debrief, watch, stop, or show logs.

**Backend routing:**
- In Codex, prefer native agents for bounded sidecar investigation,
  verification, review, or isolated implementation.
- In Claude Code, prefer background agents for durable delegated work when
  available.
- Use tmux for visible terminal sessions, cross-runtime launch, or fallback.

```
dispatch a task to investigate the flaky CI
dispatch #123 with --claude-bg
dispatch this refactor with --codex-native
tell the PR handle to also run the tests
```

### debrief

Check on one or all delegated handles and pull status or results back into the
current conversation.

- Reads backend-native status: Codex agent results, Claude logs/state, Claude
  subagent summaries, or tmux pane output.
- Reports the task arc: what was asked, current state, result, and whether
  intervention is needed.
- Can target one handle or sweep all known delegated work.

```
debrief the PR handle
how's everything going?
status on all delegated work
```

### watch

Auto-watch delegated work and surface meaningful deltas.

- Armed by `dispatch`.
- Reports new handles, completions, failures, needs-input states, or tmux pane
  tail changes.
- To stop status notifications, say "stop watching". Delegated work keeps
  running.

### logs

Show raw or near-raw backend detail when available.

- Claude background agents: `claude logs <id>`.
- Tmux: recent pane output.
- Codex native agents and Claude subagents: latest known status or final
  summary only.

### stop

Stop or cancel delegated work without disabling the watcher globally.

- Codex native: close/cancel the native agent handle when supported.
- Claude background: `claude stop <id>`.
- Tmux: graceful interrupt first.

### attach

Optional backend-specific escape hatch. Attach is not part of the portable
Legate contract.

- Claude background agents may support `claude attach <id>`.
- Tmux can switch to the target window.
- Codex native agents and Claude subagents are mediated through the parent
  conversation; use `debrief`, `logs`, or follow-up instructions instead.

Legacy "inspect" language routes here when the backend supports direct control.

## How it works

Every dispatch records a logical handle:

```text
<!-- legate:handles -->
- <name>|backend=<backend>|id=<backend-id>|cwd=<path>|source=<source>|desc=<description>
```

Backends provide their own state surfaces. Claude background agents expose
CLI commands and state files, Codex native agents expose parent-conversation
handles, Claude subagents return summaries, and tmux windows carry Legate
metadata tags.

## Installation

```bash
claude plugin install legate@toolshed
```

Or inside Claude Code:

```text
/plugin install legate@toolshed
```
