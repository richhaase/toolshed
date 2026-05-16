# Legate conventions

Shared naming, handle, and snapshot conventions for every Legate skill.
Legate's source of truth is the selected backend plus conversation history.
Tmux tags are one backend implementation, not the portable model.

## Handles

Every dispatch records a logical handle in conversation history:

```text
<!-- legate:handles -->
- <name>|backend=<backend>|id=<backend-id>|cwd=<path>|source=<source>|desc=<description>
```

Resolve user references from conversation context first. If that is ambiguous,
query backend-native discovery: Codex agent handles in the parent conversation,
Claude background state/logs, or tmux tags.

Backend names:

- `codex-native`
- `claude-bg`
- `claude-subagent`
- `tmux`

See `backends.md` for routing and capability details.

## Tmux window tags

The tmux backend tags every dispatched window with these user options. Read with
`tmux show-option -wv -t "<name>" <tag>`; set with
`tmux set-option -w -t "<name>" <tag> <value>`.

| Tag | Set by | Purpose |
|-----|--------|---------|
| `@legate-managed` | `dispatch` | Marks the window as legate-managed. Tmux sweeps filter on this. |
| `@legate-description` | `dispatch` | Short human-readable description of the task. |
| `@legate-source` | `dispatch` | Source identifier, e.g. `gh:owner/repo#123`, `linear:TASK-100`, or `freeform`. |
| `@legate-cwd` | `dispatch` | Working directory the agent was launched in. |
| `@legate-agent` | `dispatch` | Runtime: `claude` or `codex`. |
| `@legate-parent` | `dispatch` | Pane id (`#{pane_id}`, e.g. `%42`) of the session that dispatched this window. Used by `watch` to scope tmux sweeps. |

## Tmux parent identity

`@legate-parent` is the tmux pane id of the dispatching session, captured at
launch with:

```bash
tmux display-message -p -t "$TMUX_PANE" '#{pane_id}'
```

Pane ids are tmux-session-unique, survive client attach/detach, and die with
the pane. They identify the running parent process, not a resumable
conversation, which is exactly what tmux watching needs.

When a parent dies, its children's `@legate-parent` tag dangles harmlessly. The
children keep running and remain visible via `debrief all`, `logs`, and
backend-specific `attach`; they are simply unwatched.

## Context brief

Keep the brief under 30 lines. The delegated agent has codebase access and can
read files itself; the brief should orient it on what to do and why.

```markdown
# Task: <title>

<URL if applicable>

## What needs to happen
<2-5 bullets summarizing the work>

## Review feedback (if PR)
<summarized reviewer comments>

## Key files (if known)
<files mentioned in review comments or relevant to the task>
```

### Tmux brief file

`dispatch` writes `/tmp/legate-<name>.md` with the initial task brief.
`debrief` reads this file to anchor pane-tail interpretation. If the file is
gone, fall back to `@legate-description`.

## Handle naming

Short, scannable names:

| Task type | Pattern | Example |
|-----------|---------|---------|
| PR | `pr-<number>` | `pr-123` |
| Issue ticket | `<prefix>-<number>` (lowercase) | `task-100` |
| Freeform | first 2-3 words, kebab-case | `db-migration` |

If a name already exists for the same backend, append a numeric suffix:
`pr-123-2`, `pr-123-3`, etc.

## Snapshot blocks in conversation history

`watch` persists a snapshot in its own conversation history as an HTML comment
block:

```text
<!-- legate:watch snapshot -->
- <name>|backend=<backend>|state=<state-or-hash>|desc=<description>
- <name>|backend=<backend>|state=<state-or-hash>|desc=<description>
```

An optional opt-out marker on the first line records user intent to stop
watching:

```text
<!-- legate:watch snapshot opt-out -->
```

The older tmux-only `<!-- legate:watch hashes -->` block is accepted as legacy
input, but new snapshots should use `legate:watch snapshot`.

`dispatch` clears the opt-out by invoking `watch` again. Any new dispatch
re-arms the sweep.

## Cross-skill reads

Skills invoke each other via the Skill tool, never by reading each other's
files or shelling out to each other's scripts. Each skill knows only about
backend-native tools (`tmux`, `claude`, native agent handles, `gh`, `jq`,
`git`, etc.) and its own files.
