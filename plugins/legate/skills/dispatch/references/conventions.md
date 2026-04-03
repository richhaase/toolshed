# Legate Tmux Conventions

Shared conventions used across all legate skills. Dispatch sets these tags when launching
windows; debrief and inspect read them to discover and interact with sessions.

## Window Tags

All tags are tmux user options set on the window with `tmux set-option -w`.

| Tag | Type | Set by | Purpose |
|-----|------|--------|---------|
| `@legate-managed` | `"true"` | dispatch | Marks this window as legate-managed. Used by debrief to find all sessions. |
| `@legate-description` | string | dispatch | Short human-readable description of the task (e.g., "Fix pagination bug in user list API"). Used by debrief for status reports and by all skills for resolving natural language references. |
| `@legate-source` | string | dispatch | Source identifier for the task. Format: `gh:owner/repo#123` for PRs, `issue:TASK-100` for tickets, `freeform:<slug>` for ad-hoc tasks. |
| `@legate-cwd` | path | dispatch | Working directory of the session. Used by inspect to open shells in the right place. |

## Window Naming

| Source | Name format | Example |
|--------|------------|---------|
| PR | `pr-<number>` | `pr-123` |
| Issue ticket | `<project>-<number>` (lowercase) | `task-100` |
| Freeform | First 2-3 words, kebab-case | `db-migration` |

If a name collides with an existing window, append a numeric suffix: `pr-123-2`.

## Reading Tags

```bash
tmux show-option -wv -t "<window>" @legate-description 2>/dev/null
```

## Discovering All Managed Windows

```bash
for w in $(tmux list-windows -F '#{window_name}'); do
  managed=$(tmux show-option -wv -t "$w" @legate-managed 2>/dev/null)
  if [ "$managed" = "true" ]; then
    echo "$w"
  fi
done
```
