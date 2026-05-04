---
name: followups
description: Walk open commitments and loose ends one at a time — both tasks (committed actions in sources/tasks/) and follow-ups (uncommitted captures in sources/followups/). For each item the user decides keep, dismiss, mark done, promote (follow-up → task), demote (task → follow-up), or add a note. Use when the user says "review followups", "review tasks", "what's open", "go through my open items", "triage my queue", "walk follow-ups", or "walk tasks".
argument-hint: "[tasks|followups|all] [oldest|newest]"
user-invocable: true
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion]
---

# Followups

Walk the open queues — `sources/tasks/` (committed actions) and
`sources/followups/` (uncommitted captures) — one item at a time.
Per item, decide what to do.

This is the unified review surface that replaces the older `tasks` and
`review-followups` skills. Task creation now happens in `/fin`; this
skill is for periodic triage of what already exists.

## Memento root

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
```

See `../_shared/references/memento-root.md` for the full resolution
contract. All `sources/` paths below are relative to `MEMENTO_ROOT`.

## Arguments

Arguments are passed as: $ARGUMENTS

Scope (pick one):

- No arguments or `all` → walk both queues, interleaved by date.
- `tasks` → walk only `sources/tasks/` (excludes `sources/tasks/done/`).
- `followups` → walk only `sources/followups/`.

Order modifier (optional):

- `oldest` (default) → oldest first by frontmatter `date`.
- `newest` → newest first.

A bare slug is also accepted to jump to a single item:

- `<slug>` → look up `sources/tasks/<slug>.md` first, then
  `sources/followups/<slug>.md`. Walks just that one file.

## Gotchas

- **Tasks vs follow-ups still matters.** Tasks are commitments;
  follow-ups are everything else. Promotion (follow-up → task)
  requires explicit user confirmation that the item is a real
  commitment, not "we should think about it." Demotion is cheap.
- **One item per turn.** Present a single file at a time and wait
  for the decision before moving on.
- **Empty queue ⇒ stop.** If the worklist is empty, say so and exit.
  No commit.
- **Default to keep.** When the user is non-committal or distracted,
  the honest action is `keep`, not `dismiss`. Dismissal should be a
  deliberate "no, this doesn't matter."
- **Never push.** Local commit only.

## Step 1: Build the worklist

Glob according to scope:

```bash
# all
ls "$MEMENTO_ROOT/sources/tasks/"*.md "$MEMENTO_ROOT/sources/followups/"*.md 2>/dev/null
# tasks only
ls "$MEMENTO_ROOT/sources/tasks/"*.md 2>/dev/null
# followups only
ls "$MEMENTO_ROOT/sources/followups/"*.md 2>/dev/null
```

(Exclude `sources/tasks/done/`.)

Read each file's frontmatter `date` and the first `#` heading. Build:

```
queue: tasks|followups
date: YYYY-MM-DD
slug: my-slug
title: First H1
```

Sort by `date` per the order modifier. If a single slug was passed,
the worklist is just that file.

If the worklist is empty, print:

```
No open items in <scope>.
```

and stop. Do not commit.

If the worklist has more than 10 items, tell the user the count
up front:

```
14 open items (8 tasks, 6 follow-ups). Walking oldest-first. Say
"stop" any time to bail.
```

## Step 2: Walk one at a time

For each item:

```
---

**<title>** — <queue> opened YYYY-MM-DD (N days ago)
File: sources/<queue>/<slug>.md
<origin field if present>

<full body of the file — not a summary>
```

Then ask via `AskUserQuestion`. Options depend on queue:

**For follow-ups:**

- `keep` — leave it; revisit next walk
- `dismiss` — delete it
- `promote` — convert to a task (requires commitment confirmation)
- `answer` — capture an answer/context
- `note` — append a dated `## Notes` entry without changing status
- `skip` — advance without deciding
- `stop` — end the walk

**For tasks:**

- `keep` — leave it
- `dismiss` — delete (no longer relevant)
- `done` — task is complete
- `demote` — move back to a follow-up
- `note` — append a dated `## Notes` entry
- `skip` — advance without deciding
- `stop` — end the walk

Wait for the answer. Take the action below. Then move on.

### keep / skip

Do nothing for the file. Move to the next item.

### dismiss

```bash
rm "$MEMENTO_ROOT/sources/<queue>/<slug>.md"
```

If the user gives a one-line reason, save it for the commit message.

### done (tasks only)

Default: delete the file (`rm`). If the user says "archive it" or
"keep a record," move to `sources/tasks/done/`:

```bash
mkdir -p "$MEMENTO_ROOT/sources/tasks/done"
mv "$MEMENTO_ROOT/sources/tasks/<slug>.md" "$MEMENTO_ROOT/sources/tasks/done/<slug>.md"
```

If unclear, ask: "Delete or archive to `sources/tasks/done/`?"

### promote (follow-up → task)

Confirmation gate first. Ask:

> "Promote <title> to a task? Tasks are commitments — only promote
> if you're going to drive this. Otherwise leave it as a follow-up."

If the user does not confirm a real commitment, treat as `keep` and
move on.

On confirmation:

1. Read the follow-up file. Extract title, body, and any `## Notes`.
2. Write `sources/tasks/<slug>.md` (reuse the slug unless it
   collides; if it collides, append a discriminator like
   `<slug>-2.md`):

   ```markdown
   ---
   date: <today>
   promoted_from: sources/followups/<slug>.md
   originally_opened: <date from the follow-up frontmatter>
   ---
   # <Title>

   <Body, rephrased as a commitment if needed.>

   ## History
   - <originally_opened> opened as follow-up
   - <today> promoted to task

   <Append the follow-up's `## Notes`, if any.>
   ```

3. Delete the original follow-up file.

### demote (task → follow-up)

Inverse of promote. No confirmation required — demotion is cheap.

1. Read the task file. Extract title, body, and any `## Notes`.
2. Write `sources/followups/<slug>.md` (resolve slug collisions the
   same way):

   ```markdown
   ---
   date: <today>
   kind: followup
   demoted_from: sources/tasks/<slug>.md
   originally_opened: <date from the task frontmatter>
   ---
   # <Title>

   <Body.>

   ## History
   - <originally_opened> opened as task
   - <today> demoted to follow-up
   ```

3. Delete the original task file.

### answer (follow-ups only)

The user has the answer or new context. Ask which fits:

1. **Capture-to-wiki** — durable knowledge that belongs in `wiki/`
   (a fact about an entity, a clarification about a project).
   Append a dated source under
   `sources/notes/<YYYY-MM-DD>-<slug>.md` with frontmatter
   (`date`, `title`) and the answer body. Then delete the follow-up
   file (the open question is resolved).
2. **Append-and-keep** — answer is partial or intermediate. Append a
   dated `## Notes` entry to the follow-up file and leave it open.

When in doubt, prefer capture-to-wiki + delete: an answered
follow-up should not keep appearing in future walks.

### note

Append a dated entry to the existing file under a `## Notes`
section:

```markdown
## Notes

### YYYY-MM-DD
<note text>
```

Do not rewrite the body.

## Step 3: Wrap up

After the walk completes (or the user says `stop`), summarize:

```
## Walk complete

- Promoted: N (slugs: ...)
- Demoted: N (slugs: ...)
- Done: N (slugs: ...)
- Dismissed: N (slugs: ...)
- Answered: N (slugs: ...)
- Noted: N (slugs: ...)
- Kept: N
- Skipped: N
- Remaining unwalked: N
```

If anything changed on disk, commit once at the end:

```bash
git -C "$MEMENTO_ROOT" add sources/tasks/ sources/followups/ sources/notes/
git -C "$MEMENTO_ROOT" commit -m "followups: review — <one-line summary>"
```

Skip the commit if nothing changed.

## Guidelines

- **One at a time.** Do not present the whole worklist at once and ask
  for batched decisions. Walking is the point — it forces a decision
  per item.
- **Show the full body.** Items are usually short. Don't summarize —
  paste the body so the user has the same context that was captured
  originally.
- **Default to keep.** Dismissal is deliberate, not the easy path.
- **Promotion requires real commitment.** The whole point of the
  task vs follow-up split is that tasks shape briefings as urgent
  commitments. A misclassified task is more painful to demote than
  a missed promotion is to fix.
- **Demotion is cheap.** No confirmation needed. If the user says a
  task is no longer a commitment, move it back without ceremony.
