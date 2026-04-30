---
name: review-followups
description: Walk open follow-ups one at a time and decide what to do with each — promote to task, dismiss, keep watching, or answer-and-capture. Use when the user says "review follow-ups", "walk follow-ups", "what follow-ups are open", "go through my follow-ups", or "triage follow-ups". Follow-ups are uncommitted captures (open questions, loose ends, awareness items) that live in `sources/followups/`. This is how they get periodically inspected — they are not surfaced in routine briefings.
argument-hint: "[oldest|newest|topic-slug]"
user-invocable: true
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Skill]
---

# Review Follow-ups

Walk open follow-ups one at a time. For each, decide: promote to task,
dismiss, keep, or answer-and-capture.

Follow-ups are the default destination for `fin` captures that do not
represent a user-committed action. They accumulate. This skill is the
periodic walk-through that keeps the pile honest.

## Memento root

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
```

See `../_shared/references/memento-root.md` for the full resolution contract.
All follow-up paths are relative to `MEMENTO_ROOT`.

## Arguments

Arguments are passed as: $ARGUMENTS

- No arguments → walk all open follow-ups, **oldest-first** (default).
- `oldest` → same as no arguments. Explicit form.
- `newest` → walk newest-first. Useful when you want to triage what just
  landed before letting the older pile sit.
- `<topic-slug>` → jump straight to one follow-up by filename slug.

## Default heuristic: oldest-first

Open follow-ups are sorted by frontmatter `date` ascending. The oldest
item is presented first.

Why oldest-first:
- Follow-ups rot. The longer one sits unaddressed, the more likely it is
  either no longer relevant (dismiss) or quietly important (promote).
  Either way it deserves a decision.
- A "most-recent decay score" sounds smart but requires touching every
  file with git metadata; oldest-by-frontmatter is fast, deterministic,
  and good enough.
- Explicit override is cheap: pass `newest` or a specific slug.

If the user wants a different ordering, they say so. Don't second-guess
the heuristic mid-walk.

## Step 1: Build the worklist

Glob `sources/followups/*.md`. Read each file's frontmatter `date` field
and title (first `#` heading). Build an in-memory list:

```
date: YYYY-MM-DD  slug: my-followup-slug  title: Short title from H1
```

Sort according to the mode (oldest/newest). If a single slug was passed,
the worklist is just that one file.

If the worklist is empty, print "No open follow-ups." and stop.

If the worklist is large (>10 items), tell the user the count up front so
they know what they're agreeing to walk:

```
12 open follow-ups. Walking oldest-first. Say "stop" any time to bail.
```

## Step 2: Present and decide, one at a time

For each item in the worklist, present it and wait for the user's
decision before moving on.

Format:

```
---

**<title>** — opened YYYY-MM-DD (N days ago)
File: sources/followups/<slug>.md
Origin: <origin field, if present>

<full body of the follow-up — not just a summary>

What now?
- **promote** — convert to a committed task in `sources/tasks/`
- **dismiss** — delete it (no longer relevant / answered elsewhere)
- **keep** — leave it; revisit on the next walk
- **answer** — you have an answer / context to capture; I'll write it to
  the wiki or the file as appropriate
- **skip** — move to the next item without deciding
- **stop** — end the walk
```

Wait for the user's response. Then take the action below. Then move to
the next item.

### promote

Hand off to the `tasks` skill in promote mode:

```
Skill: tasks
args: promote sources/followups/<slug>.md
```

The `tasks` skill is responsible for converting the follow-up file into a
task file (moving it from `sources/followups/` to `sources/tasks/`,
rewriting frontmatter, asking any clarifying questions about scope).
Do not perform the conversion in this skill.

### dismiss

Delete the file:

```bash
rm "$MEMENTO_ROOT/sources/followups/<slug>.md"
```

If the user gives a one-line reason for dismissing, capture it in the
commit message. Otherwise commit with a generic "no longer relevant" note.

### keep

Do nothing. Move on.

### answer

The user has the answer or new context. Two sub-options:

1. **Capture-to-wiki** — the answer is durable knowledge that belongs in
   `wiki/` (e.g., a fact about an entity, a clarification about a
   project). Append the answer as a dated source under
   `sources/notes/<YYYY-MM-DD>-<slug>.md` with frontmatter `date` and
   `title`, then run `/compile <topic>` to fold it into the relevant wiki
   page on the next pass. After capture, delete the follow-up file
   (the open question is now resolved).

2. **Append-and-keep** — the answer is partial, conditional, or
   intermediate. Append a dated `## Notes` entry to the follow-up file
   with the new context and leave the file open.

Ask which sub-option if it isn't obvious. When in doubt, prefer
capture-to-wiki + delete: an answered follow-up should not keep
appearing in future walks.

### skip / stop

`skip` advances to the next item without writing anything. `stop` ends
the walk immediately and goes to Step 3.

## Step 3: Wrap up

After the walk completes (or the user says stop), summarize what
happened:

```
## Walk complete

- Promoted: N (slugs: ...)
- Dismissed: N (slugs: ...)
- Answered: N (slugs: ...)
- Kept: N
- Skipped: N
- Remaining unwalked: N
```

If any files were written, moved, or deleted during the walk, commit:

```bash
git -C "$MEMENTO_ROOT" add sources/followups/ sources/tasks/ wiki/
git -C "$MEMENTO_ROOT" commit -m "review-followups: <one-line summary of actions>"
```

Skip the commit if nothing changed.

## Guidelines

- **One at a time.** Do not present the whole worklist at once and ask
  for batched decisions. Walking is the point — it forces a decision per
  item.
- **Show the full body.** Follow-ups are usually short. Don't summarize
  them — paste the body so the user has the same context that was
  captured originally.
- **Default to keep.** If the user is non-committal or distracted, the
  honest action is `keep`, not `dismiss`. Dismissal should be a
  deliberate "no, this doesn't matter."
- **Promotion is cheap.** Don't gatekeep the promote action. If the user
  says "yeah, let's drive that," promote it.
