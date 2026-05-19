# Legate conventions

Shared naming, handle, and snapshot conventions for every Legate skill.
Legate's source of truth is a set of tmux windows tagged with `@legate-*`
user options plus the handle and snapshot blocks recorded in conversation
history.

## Handles

Every dispatch records a logical handle in conversation history:

```text
<!-- legate:handles -->
- <name>|id=<window-name>|cwd=<path>|source=<source>|desc=<description>
```

Resolve user references from conversation context first. If that is
ambiguous, query tmux directly:

```bash
tmux list-windows -a -F '#{window_name} #{@legate-managed}' \
  | awk '$2 == "yes" {print $1}'
```

## Tmux window tags

Every dispatched window is tagged with these user options. Read with
`tmux show-option -wv -t "<name>" <tag>`; set with
`tmux set-option -w -t "<name>" <tag> <value>`.

| Tag | Set by | Purpose |
|-----|--------|---------|
| `@legate-managed` | `dispatch` | Marks the window as legate-managed. Sweeps filter on this. |
| `@legate-description` | `dispatch` | Short human-readable description of the task. |
| `@legate-source` | `dispatch` | Source identifier, e.g. `gh:owner/repo#123`, `linear:TASK-100`, or `freeform`. |
| `@legate-cwd` | `dispatch` | Working directory the agent was launched in. |
| `@legate-agent` | `dispatch` | Runtime: `claude` or `codex`. |
| `@legate-parent` | `dispatch` | Pane id (`#{pane_id}`, e.g. `%42`) of the session that dispatched this window. Used by `watch` to scope tmux sweeps. |

## Parent identity

`@legate-parent` is the tmux pane id of the dispatching session, captured at
launch with:

```bash
tmux display-message -p -t "$TMUX_PANE" '#{pane_id}'
```

Pane ids are tmux-session-unique, survive client attach/detach, and die with
the pane. They identify the running parent process, not a resumable
conversation, which is exactly what watching needs.

When a parent dies, its children's `@legate-parent` tag dangles harmlessly.
The children keep running and remain visible via `debrief all`, `logs`, and
`attach`; they are simply unwatched.

## Context brief

Keep the brief under 30 lines. The delegated agent has codebase access and
can read files itself; the brief should orient it on what to do and why.

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

### Brief file

`dispatch` writes `/tmp/legate-<name>.md` with the initial task brief.
`debrief` reads this file to anchor pane-tail interpretation. If the file
is gone, fall back to `@legate-description`.

## Handle naming

Short, scannable names:

| Task type | Pattern | Example |
|-----------|---------|---------|
| PR | `pr-<number>` | `pr-123` |
| Issue ticket | `<prefix>-<number>` (lowercase) | `task-100` |
| Freeform | first 2-3 words, kebab-case | `db-migration` |

If a name already exists, append a numeric suffix: `pr-123-2`, `pr-123-3`,
etc.

## Snapshot blocks in conversation history

`watch` persists a snapshot in its own conversation history as an HTML
comment block:

```text
<!-- legate:watch snapshot -->
- <name>|hash=<sha1>|desc=<description>
- <name>|hash=<sha1>|desc=<description>
```

An optional opt-out marker on the first line records user intent to stop
watching:

```text
<!-- legate:watch snapshot opt-out -->
```

The older `<!-- legate:watch hashes -->` block is accepted as legacy input,
but new snapshots should use `legate:watch snapshot`.

`dispatch` clears the opt-out by invoking `watch` again. Any new dispatch
re-arms the sweep.

## Cross-skill reads

Skills invoke each other via the Skill tool, never by reading each other's
files or shelling out to each other's scripts. Each skill knows only about
backend-native tools (`tmux`, `gh`, `jq`, `git`, etc.) and its own files.
