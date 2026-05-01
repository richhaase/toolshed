# Legate conventions

Shared tag contract and naming conventions for every legate skill. Tmux is the
source of truth — these tags and names are the only state.

## Tmux window tags

Every dispatched window carries these user options. Read with
`tmux show-option -wv -t "<name>" <tag>`; set with
`tmux set-option -w -t "<name>" <tag> <value>`.

| Tag | Set by | Purpose |
|-----|--------|---------|
| `@legate-managed` | `dispatch` | Marks the window as legate-managed. Every legate sweep filters on this. |
| `@legate-description` | `dispatch` | Short human-readable description of the task. |
| `@legate-source` | `dispatch` | Source identifier, e.g. `gh:owner/repo#123`, `linear:TASK-100`, or `freeform`. |
| `@legate-cwd` | `dispatch` | Working directory the agent was launched in. |
| `@legate-agent` | `dispatch` | Runtime: `claude` or `codex`. |
| `@legate-parent` | `dispatch` | Pane id (`#{pane_id}`, e.g. `%42`) of the session that dispatched this window. Used by `watch` to scope sweeps to its own children. |

## Parent identity

`@legate-parent` is the tmux pane id of the dispatching session, captured at
launch with:

```bash
tmux display-message -p -t "$TMUX_PANE" '#{pane_id}'
```

Pane ids are tmux-session-unique, survive client attach/detach, and die with
the pane. They identify the running parent process, not a resumable
conversation — which is exactly what watching needs.

When a parent dies, its children's `@legate-parent` tag dangles harmlessly.
The children keep running and remain visible via `debrief all` and `inspect`;
they're simply unwatched.

## Context brief file

`dispatch` writes `/tmp/legate-<name>.md` with the initial task brief.
`debrief` reads this file to anchor pane-tail interpretation. If the file is
gone (reboot, manual cleanup), fall back to `@legate-description`.

## Window naming

Short, scannable tmux window names:

| Task type | Pattern | Example |
|-----------|---------|---------|
| PR | `pr-<number>` | `pr-123` |
| Issue ticket | `<prefix>-<number>` (lowercase) | `task-100` |
| Freeform | first 2–3 words, kebab-case | `db-migration` |

If a window with the chosen name already exists, append a numeric suffix:
`pr-123-2`, `pr-123-3`, etc.

## Snapshot blocks in conversation history

`watch` persists its hash snapshot in its own conversation history as an HTML
comment block:

```
<!-- legate:watch hashes -->
- <window>|<hash>|<description>
- <window>|<hash>|<description>
```

An optional opt-out marker on the first line records user intent to stop
watching:

```
<!-- legate:watch hashes opt-out -->
```

`dispatch` clears the opt-out by invoking `watch` again — any new dispatch
re-arms the sweep.

## Cross-skill reads

Skills invoke each other via the Skill tool, never by reading each other's
files or shelling out to each other's scripts. Each skill knows only about
external tools (`tmux`, `gh`, `jq`, `git`, etc.) and its own files.
