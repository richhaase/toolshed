---
name: tasks
description: >
  Create, list, update, and complete tasks in the knowledge base. Tasks are markdown files
  in sources/tasks/ — file existence means the task is open. Use when the user says "create
  a task", "add a task", "new task", "list tasks", "show tasks", "what's open", "mark done",
  "complete task", "update task", "task status", "todo", "what do I need to do", or otherwise
  wants to manage action items. Supports CRUD operations: create, list/read, update, done.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

# Tasks

Task management via the filesystem. Each task is a markdown file in `sources/tasks/`.
File existence = open task. No databases, no IDs — just files.

## Operations

### Create

Create a new task file at `sources/tasks/<slug>.md`.

**Before creating:** Check for duplicates.

```bash
ls sources/tasks/*.md 2>/dev/null
```

Scan existing task filenames and titles for overlap. If a similar task exists, ask the
user if they want to update the existing one or create a new one.

**Filename:** `<topic-slug>.md` — no date prefix. The date goes in frontmatter.

**Simple task** (just a title, no context needed):

```markdown
---
title: <Task title>
date: <today ISO 8601>
---

# <Task title>
```

**Complex task** (needs context, subtasks, or acceptance criteria):

```markdown
---
title: <Task title>
date: <today ISO 8601>
tags: [<relevant tags>]
---

# <Task title>

## Context
<Why this task exists, background information>

## Subtasks
- [ ] <Subtask 1>
- [ ] <Subtask 2>
- [ ] <Subtask 3>

## Notes
<Any additional context, links, references>
```

After creating, confirm to the user with the filename and title.

### List

Show all open tasks, sorted by date (most recent first).

```bash
ls -1 sources/tasks/*.md 2>/dev/null | grep -v done/
```

For each task file:
1. Read the frontmatter to extract title and date
2. Display as a sorted list

**Output format:**

```
## Open tasks

1. **Task title** — `sources/tasks/slug.md` (created <date>)
2. **Task title** — `sources/tasks/slug.md` (created <date>)

<count> open tasks
```

If no tasks exist, say so clearly.

For larger task lists (>10), batch the reads using parallel Read calls.

### Update

Modify an existing task. The user might:
- Add context or notes
- Add/check subtasks
- Change the title
- Add tags

**Resolve which task:** Match the user's description to an existing task file. If
ambiguous, list tasks and ask.

**Edit the file** using the Edit tool. Preserve existing content — add to it, don't
replace unless explicitly asked.

### Done

Mark a task as complete. Two modes:

**Delete (default):** Remove the task file. The task is done; it doesn't need to exist.

```bash
rm sources/tasks/<slug>.md
```

**Archive:** Move to `sources/tasks/done/` for historical reference. Use this when
the user says "archive" or the task has significant context worth keeping.

```bash
mv sources/tasks/<slug>.md sources/tasks/done/<slug>.md
```

Add a `completed` date to the frontmatter when archiving:

```markdown
---
title: <Task title>
date: <original date>
completed: <today ISO 8601>
---
```

**Resolve which task:** Match the user's description to an existing task file. If
ambiguous, list tasks and ask.

After completing, confirm to the user and report remaining open task count.

### Commit

After any create/update/done operation, commit the change:

```bash
git add sources/tasks/
git commit -m "tasks: <action> — <task title>"
```

Action words: `create`, `update`, `complete`, `archive`.

## Conventions

- Filenames are lowercase, hyphenated, no spaces: `migrate-users-table.md`
- No date prefix in filename — date is in frontmatter
- One task per file
- Keep tasks atomic — if a task has many subtasks, consider splitting into separate tasks
- Tags are optional but useful for filtering
