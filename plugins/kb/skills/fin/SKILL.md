---
name: fin
description: >
  Finish a session by extracting and persisting valuable information from the conversation.
  Scans for decisions, tasks, research findings, and notes worth keeping, then routes them
  to the appropriate KB files. Use when the user says "fin", "finish", "wrap up", "end
  session", "save what we did", "capture this session", "persist this", "session done",
  "let's close out", or is ending a work session and wants to preserve what was learned
  or decided. Most sessions produce 0-2 items — don't over-capture.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - AskUserQuestion
---

# Fin

Extract value from the current session and persist it to the KB. Light-touch —
most sessions produce 0-2 items worth capturing. Don't over-capture.

## What to capture

Scan the conversation for:

### Decisions
Explicit choices that affect future work. Route to the relevant entity's source file
or create a new one.

Example: "We decided to use PostgreSQL instead of MySQL" → source note or wiki update.

### Tasks
Action items that came up but weren't completed. Route to `sources/tasks/`.

Example: "We should migrate that table next week" → `sources/tasks/migrate-table.md`

### Research findings
New information learned during the session. Route to `sources/` as a research doc.

Example: "Discovered that the API rate limit is 100/min, not 60" → research doc with
the finding, source, and staleness rating.

### Notes
Observations, context, or knowledge worth preserving that don't fit other categories.
Route to `sources/` as a note.

## Capture process

### Step 1: Scan and categorize

Review the conversation and identify items worth capturing. For each item, determine:
- **Type**: decision, task, research, or note
- **Content**: the essential information (concise)
- **Destination**: which file it should go to

### Step 2: Present capture plan

Show the user what you plan to capture before writing anything:

```
## Session capture plan

1. **Task**: Migrate users table to new schema
   → `sources/tasks/migrate-users-table.md`

2. **Decision**: Use PostgreSQL for the analytics service
   → Append to `sources/analytics-service.md`

Nothing else worth capturing from this session.

Proceed? (y/n, or edit)
```

Wait for user approval. They may:
- Approve as-is
- Remove items ("skip #2")
- Add items ("also capture X")
- Modify destinations

### Step 3: Write files

For each approved item:

**Tasks** → Create `sources/tasks/<slug>.md`:
```markdown
---
title: <Task title>
date: <today ISO 8601>
---

# <Task title>

<Context from the session — why this task exists, what needs to happen>
```

**Decisions** → Append to existing source file or create new one:
```markdown
## Decision: <title> (<date>)

<What was decided and why>
```

**Research** → Create `sources/<date>-<slug>.md`:
```markdown
---
title: <Topic>
date: <today ISO 8601>
tags: [<relevant tags>]
sources:
  - description: <where the info came from>
    accessed: <today>
staleness: medium
---

# <Topic>

<Findings>
```

**Notes** → Create or append to `sources/<slug>.md`:
```markdown
---
title: <Note title>
date: <today ISO 8601>
---

# <Note title>

<Content>
```

### Step 4: Commit

Stage and commit all new/modified files:

```bash
git add sources/
git commit -m "fin: capture session — <brief summary>"
```

### Step 5: Report

Tell the user what was captured and where. If nothing was worth capturing, say so —
"Clean session, nothing to persist" is a valid outcome.

## Guidelines

- **Less is more.** Don't capture things the user can easily recall or re-derive.
  Capture decisions (hard to reconstruct), tasks (easy to forget), and novel findings.
- **Don't capture conversation mechanics.** "We discussed X" is not worth persisting;
  "We decided X because Y" is.
- **Respect existing files.** Read before appending. Don't duplicate information already
  in the KB.
- **Check for duplicate tasks.** Before creating a task file, check if a similar one
  already exists in `sources/tasks/`.
