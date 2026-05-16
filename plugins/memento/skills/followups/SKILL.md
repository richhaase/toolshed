---
name: followups
description: Inventory, view, or triage open commitments and loose ends — both tasks (committed actions in sources/tasks/) and follow-ups (uncommitted captures in sources/followups/). Subcommands list (default; print open items), show (display one item read-only), and walk (interactive triage one at a time — keep, dismiss, mark done, promote, demote, note). Use when the user says "list my open items", "what's open", "show me followup X", "review followups", "review tasks", "go through my open items", "triage my queue", "walk follow-ups", or "walk tasks".
argument-hint: "[list|show|walk] [tasks|followups|all|<slug> ...] [oldest|newest]"
user-invocable: true
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion]
---

# Followups

Surface open work — `sources/tasks/` (committed actions) and
`sources/followups/` (uncommitted captures) — at three levels of
engagement: see what's open (`list`), look at one item (`show`), or
triage one-by-one (`walk`).

This is the unified review surface that replaces the older `tasks` and
`review-followups` skills. Task creation now happens in `/save`; this
skill is for periodic triage of what already exists.

## Memento root

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
```

See `../_shared/references/memento-root.md` for the full resolution
contract. All `sources/` paths below are relative to `MEMENTO_ROOT`.

## Arguments

Arguments are passed as: $ARGUMENTS

Shape:

```
[list|show|walk] [tasks|followups|all|<slug> ...] [oldest|newest]
```

Subcommand (first token):

- `list` (default) — print an inventory of open items, no triage.
- `show` — render a single item end-to-end, read-only.
- `walk` — interactive triage, one item per turn.

Scope / target tokens (after the subcommand):

- `tasks` → only `sources/tasks/` (excludes `sources/tasks/done/`).
- `followups` → only `sources/followups/`.
- `all` → both queues.
- `<slug>` (one or more) → specific items, resolved as
  `sources/tasks/<slug>.md` first, then `sources/followups/<slug>.md`.

Order modifier (optional, last token):

- `oldest` (default) → oldest first by frontmatter `date`.
- `newest` → newest first.
- Ignored when explicit slugs are passed (the slug order wins).

Defaults:

- No arguments → `list all oldest`.
- A bare slug with no subcommand (`<slug>`) → `show <slug>`. Both
  default surfaces are read-only; triage is opt-in via `walk`.

Examples:

- `/followups` → list everything open.
- `/followups list tasks` → list only open tasks.
- `/followups my-slug` → show that one item read-only.
- `/followups show my-slug` → same.
- `/followups walk` → triage the full queue.
- `/followups walk followups newest` → triage follow-ups, newest first.
- `/followups walk a b c` → triage just those three items, in order.

## Gotchas

- **Tasks vs follow-ups still matters.** Tasks are commitments;
  follow-ups are everything else. Promotion (follow-up → task)
  requires explicit user confirmation that the item is a real
  commitment, not "we should think about it." Demotion is cheap.
- **One item per turn (walk only).** Present a single file at a time
  and wait for the decision before moving on. `list` and `show` are
  not interactive — print and exit.
- **Empty queue ⇒ stop.** If the worklist is empty, say so and exit.
  No commit.
- **Default to keep (walk only).** When the user is non-committal or
  distracted, the honest action is `keep`, not `dismiss`. Dismissal
  should be a deliberate "no, this doesn't matter."
- **Never push.** Local commit only, and only `walk` ever commits.

## Step 1: Build the worklist

Used by all three subcommands. Glob according to scope:

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
path: sources/<queue>/<slug>.md
```

Sort by `date` per the order modifier. If explicit slugs were passed,
the worklist is exactly those files in the given order; resolve each
slug as `sources/tasks/<slug>.md` first, then
`sources/followups/<slug>.md`. Error on any slug that resolves
nowhere.

If the worklist is empty, print:

```
No open items in <scope>.
```

and stop. Do not commit.

## Subcommand: list

After Step 1, print one line per item:

```
<queue>  <date>  <slug>  <title>
```

Group by queue (tasks first, then followups) so the user can see the
split at a glance. If both queues are present, prefix with totals:

```
3 tasks, 5 follow-ups (8 open):

tasks
  2026-04-12  ship-onboarding-doc  Ship the onboarding doc
  2026-04-30  rotate-prod-creds    Rotate prod credentials
  2026-05-08  q2-okr-draft         Draft Q2 OKRs

follow-ups
  2026-03-22  s3-egress-question   Why is S3 egress so high?
  ...
```

If only one queue is in scope, drop the group headers and the totals
line — just print the rows.

Exit after printing. No `AskUserQuestion`, no commit.

## Subcommand: show

Resolve the single slug via Step 1 (or error if not found). Render the
item exactly as `walk` would render it (see "render block" in Step 2),
then exit. Read-only — no `AskUserQuestion`, no commit.

If multiple slugs are passed to `show`, render each one in turn,
separated by `---`, then exit.

## Step 2: Walk one at a time (walk subcommand)

For each item, render the block:

```
---

**<title>** — <queue> opened YYYY-MM-DD (N days ago)
File: sources/<queue>/<slug>.md
<origin field if present>

<full body of the file — not a summary>
```

If the worklist has more than 10 items, tell the user the count up
front before the first render:

```
14 open items (8 tasks, 6 follow-ups). Walking oldest-first. Say
"stop" any time to bail.
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

## Step 3: Wrap up (walk subcommand)

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

Skip the commit if nothing changed. `list` and `show` never commit.

## Guidelines

- **One at a time (walk).** Do not present the whole worklist at once
  and ask for batched decisions. Walking is the point — it forces a
  decision per item. Use `list` if the user just wants to see what's
  open.
- **Show the full body (show / walk).** Items are usually short.
  Don't summarize — paste the body so the user has the same context
  that was captured originally.
- **Default to keep.** Dismissal is deliberate, not the easy path.
- **Promotion requires real commitment.** The whole point of the
  task vs follow-up split is that tasks shape briefings as urgent
  commitments. A misclassified task is more painful to demote than
  a missed promotion is to fix.
- **Demotion is cheap.** No confirmation needed. If the user says a
  task is no longer a commitment, move it back without ceremony.
