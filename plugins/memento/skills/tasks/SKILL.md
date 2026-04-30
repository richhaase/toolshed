---
name: tasks
description: Manage tasks in the Memento — create, list, update, complete, and promote follow-ups into tasks. Use this skill when the user mentions tasks, action items, or commitments. Triggers on phrases like "add a task", "what's on my plate", "mark that done", "task for X", "open tasks", "I need to remember to", "I'm going to drive X", "promote this follow-up", or any request to track or manage committed work. Also invoked by fin for task creation and by review-followups for promotion. Tasks are commitments — for uncommitted captures (open questions, awareness items, loose ends), use follow-ups via fin or review-followups instead.
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

# Tasks

Manage task files in `sources/tasks/`. Each task is its own markdown file — existence means open, deletion means done.

## Memento root

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
```

See `../_shared/references/memento-root.md` for the full resolution contract.
All task paths are relative to `MEMENTO_ROOT`.

## Modes

Determine the mode from context. If ambiguous, ask.

### Create

**Tasks are commitments.** Create a task only when the user has explicitly
said they will drive an action. If the input is "this exists / someone
asked / open question / we should think about X / I'll look at it later,"
that is a follow-up, not a task — file it via `fin` or hand it back so it
lands in `sources/followups/` instead. Promotion (follow-up → task) is
cheap and happens via the `promote` mode below.

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

### Promote

Convert an existing follow-up into a task. Triggered by `review-followups`
or directly by the user ("promote that follow-up", "make X a task").

Input: a path to a follow-up file under `sources/followups/<slug>.md`.

Procedure:

1. Read the follow-up file. Extract the title (first `#` heading), body,
   and any `## Notes` history.
2. Confirm with the user that this represents a real commitment — not
   "we should think about it" but "I'm going to drive this." If the
   commitment is unclear, ask one question to pin it down (e.g., "is
   this something you're going to drive, or should it stay as a
   follow-up?"). If the answer is no, leave the follow-up in place and
   stop.
3. Write a new task file at `sources/tasks/<slug>.md` (reuse the slug
   unless it collides with an existing task). Frontmatter:

   ```markdown
   ---
   date: <today>
   promoted_from: sources/followups/<slug>.md
   originally_opened: <date from the follow-up frontmatter>
   ---
   # <Title>

   <Body from the follow-up, rephrased as a commitment if needed.>

   ## History
   - YYYY-MM-DD opened as follow-up
   - YYYY-MM-DD promoted to task

   <Append the follow-up's `## Notes`, if any.>
   ```

4. Delete the original follow-up file. The task is now the canonical
   record.
5. Commit:

   ```bash
   git -C "$MEMENTO_ROOT" add sources/tasks/ sources/followups/
   git -C "$MEMENTO_ROOT" commit -m "tasks: promote — <task title>"
   ```

Do not promote silently. The user has to confirm the commitment, since
that confirmation is the whole point of the task vs follow-up split.

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

Action words: `create`, `update`, `complete`, `archive`, `promote`.
