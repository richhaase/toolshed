---
name: remember
description: Additive Memento capture workflow. Use when the user asks to remember, capture, save to notes, or preserve context as source material.
argument-hint: "<thing to remember>"
user-invocable: true
allowed-tools: [Read, Write, Glob, Bash]
---

# Remember

Capture new source material in `sources/` without editing wiki pages directly.

## Memento root

Resolve the Memento data root before writing:

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
../_shared/scripts/memento-run pwd
```

All paths below are relative to `MEMENTO_ROOT`. Write only under `sources/`.
Never write `wiki/`, `AGENTS.md`, or `private/` from this skill.

## Workflow

1. Run `date '+%Y-%m-%dT%H%M%S'` for a stable timestamp.
2. Pick the narrowest source type:
   - `sources/notes/` for standalone remembered facts or decisions.
   - `sources/sessions/` for session summaries.
   - `sources/tasks/` only when the user is explicitly creating a task.
3. Check for an obvious duplicate with `rg` across `sources/`.
4. Write a new Markdown source with frontmatter:

```yaml
---
date: YYYY-MM-DD
status: active
tags: [tag-one, tag-two]
---
```

5. Put the captured content in concise prose below the frontmatter. Preserve
   user-provided facts; do not embellish.
6. Commit when the Memento root is a git repo:

```bash
git -C "$MEMENTO_ROOT" add sources/
git -C "$MEMENTO_ROOT" commit -m "remember: capture <brief topic>"
```

## Output

Report the source file path and whether the commit was created or skipped.
Suggest running `compile` only when the user needs L1/L2 refreshed immediately.
