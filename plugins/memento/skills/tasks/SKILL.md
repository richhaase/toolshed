---
name: tasks
description: Manage tasks in the Memento — create, list, update, and complete tasks. Use this skill when the user mentions tasks, action items, to-dos, or follow-ups. Triggers on phrases like "add a task", "what's on my plate", "mark that done", "task for X", "open tasks", "I need to remember to", "follow up on", or any request to track, review, or manage work items. Also invoked by fin for task creation.
---

# Tasks

Manage task files in `sources/tasks/`. Each task is its own markdown file — existence means open, deletion means done.

## Memento root

Resolve the Memento data root before reading or writing task files:

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
../_shared/scripts/memento-run pwd
```

All task paths are relative to `MEMENTO_ROOT`, not necessarily the current repo. Use
absolute paths under `MEMENTO_ROOT` for file reads/writes and `git -C "$MEMENTO_ROOT" ...`
for commits. Script paths are shown relative to this `SKILL.md`; if your shell
is in another directory, invoke the same scripts by absolute path.

## Modes

Determine the mode from context. If ambiguous, ask.

### Create

Make a new task file in `sources/tasks/`.

**Filename:** `sources/tasks/topic-slug.md` — short, descriptive, scannable in a directory listing. No date prefix (date lives in frontmatter). Use lowercase with hyphens.

Decide the right weight based on what the user gives you:

**Simple task** (one-liner, no extra context needed):

```markdown
---
date: YYYY-MM-DD
---
# Review API rate limiting configuration
```

**Complex task** (has context, subtasks, links, or needs explanation):

```markdown
---
date: YYYY-MM-DD
---
# Evaluate database migration strategy

Came out of architecture discussion. Need to compare approaches before committing to a migration path.

## Context
- Current schema has grown organically, needs cleanup
- Performance issues on key queries
- Team has time in the next sprint

## Subtasks
- [ ] Benchmark current query performance
- [ ] Prototype alternative schema
- [ ] Get cost estimate for migration downtime
```

**Before creating:** Glob `sources/tasks/*.md` to check for duplicates or related tasks. If something similar exists, ask whether to update the existing task or create a new one.

### List

Show what's open. Glob `sources/tasks/*.md` (excluding `sources/tasks/done/`), read each file's title and date, and present a summary:

```
Open tasks (5):
  2026-03-30  api-rate-limiting.md — Review API rate limiting configuration
  2026-03-28  database-migration.md — Evaluate database migration strategy
  ...
```

Sort by date, newest first. If there are many tasks, group by week or offer to filter.

### Update

Add context, notes, or subtasks to an existing task. Read the file, append or edit as appropriate, write it back. Common updates:

- Adding context learned from a conversation
- Checking off subtasks
- Adding links to tickets or PRs
- Adding notes on progress

### Done

Complete a task. Two options:

- **Delete** — just remove the file. Clean and simple. This is the default.
- **Archive** — move to `sources/tasks/done/` (create the directory if it doesn't exist). For tasks where a record is useful.

If the user says "that's done" or "finished the X task" without specifying, delete. If they say "archive it" or "keep a record", move to `sources/tasks/done/`.

When completing, confirm which task if there's any ambiguity.

### Commit

After any create/update/done operation, commit the change:

```bash
git -C "$MEMENTO_ROOT" add sources/tasks/
git -C "$MEMENTO_ROOT" commit -m "tasks: <action> — <task title>"
```

Action words: `create`, `update`, `complete`, `archive`.
