# Legate

> **⚠️ DEPRECATED (2026-06-02)** — superseded by Claude Code's native agents
> view (session list + resume + worktree isolation + background notifications).
> Not installable from the marketplace; code retained for reference. See
> [`DEPRECATED.md`](./DEPRECATED.md).

Delegated work orchestration for agent sessions. Legate turns the current
agent conversation into a coordinator: dispatch work into a tmux window,
watch for meaningful state changes, bring results back, and capture raw pane
output when you need detail.

Every Legate handle is a tmux window running an agent runtime (`claude` or
`codex`), tagged with `@legate-*` user options so other skills can find it.
There is no other backend — Legate is intentionally a thin coordination layer
over `tmux`.

Legate is intentionally adjacent to Memento rather than merged into it:
Legate runs delegated work; Memento preserves useful outcomes, decisions, and
follow-ups.

## Skills

### dispatch

Delegate work into a new tmux window, or send a follow-up to an existing
delegated handle.

**Launching work:**
- Accepts PR numbers (`#123`, `my-org/my-repo#45`), issue tracker tickets
  (`TASK-100`), or freeform descriptions.
- Gathers concise context: PR details via `gh`, issue info from available
  tools, or the current conversation.
- Launches a tmux window running the chosen agent runtime, tags it, and
  sends the kickoff prompt.
- Records a handle so later skills can debrief, watch, stop, or show logs.

```
dispatch a task to investigate the flaky CI
dispatch #123
tell the PR handle to also run the tests
```

### debrief

Check on one or all delegated handles and pull status or results back into
the current conversation.

- Reads the tmux window's brief file and pane tail.
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
- Compares pane-tail hashes across ticks and reports appeared, changed, or
  disappeared handles.
- To stop status notifications, say "stop watching". Delegated work keeps
  running.

### logs

Show recent pane output for a delegated window.

```
logs pr-123
logs pr-123 --tail 40
```

### stop

Send `C-c` to a delegated window. Does not kill the window unless explicitly
asked, so the user can re-attach and inspect.

### attach

Switch tmux focus to a delegated window.

```
attach pr-123
```

## How it works

Every dispatch records a logical handle:

```text
<!-- legate:handles -->
- <name>|id=<window-name>|cwd=<path>|source=<source>|desc=<description>
```

State lives in two places: the tagged tmux window (pane contents, user
options) and the conversation history (handle block, watch snapshots).
There is no external registry.

## Installation

Legate is deprecated and intentionally not installable from the Codex
marketplace. Do not install it for new work; use the harness-native agents view
instead.
