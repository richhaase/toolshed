---
name: followups
description: Inventory, view, or triage open follow-ups in sources/followups/ — the user's small queue of "re-read within a week, act on it" captures. Subcommands list (default; print open items, expired first), show (display one item read-only), and walk (interactive triage one at a time — keep, dismiss, answer, note, or file-and-dismiss to the issue tracker). Use when the user says "list my open items", "what's open", "show me followup X", "review followups", "go through my open items", "triage my queue", or "walk follow-ups".
argument-hint: "[list|show|walk] [<slug> ...] [oldest|newest|expired]"
user-invocable: true
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion]
---

# Followups

Surface and triage `sources/followups/` — the user's small queue of items
that should be re-read within a week and acted on. Three levels of
engagement: see what's open (`list`), look at one item (`show`), or
triage one-by-one (`walk`).

The Memento does not store tasks. Commitments live in the user's issue
tracker, not here. If a follow-up turns out to be a real commitment,
file it in Jira (or wherever) and dismiss the follow-up.

## Memento root

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
```

See `../_shared/references/memento-root.md` for the full resolution
contract. All `sources/followups/` paths below are relative to
`MEMENTO_ROOT`.

## Arguments

Arguments are passed as: $ARGUMENTS

Shape:

```
[list|show|walk] [<slug> ...] [oldest|newest|expired]
```

Subcommand (first token):

- `list` (default) — print an inventory of open follow-ups, no triage.
- `show` — render a single follow-up end-to-end, read-only.
- `walk` — interactive triage, one item per turn.

Target tokens (after the subcommand):

- One or more `<slug>` values → specific follow-ups, resolved as
  `sources/followups/<slug>.md`.
- Omitted → all open follow-ups.

Order modifier (optional, last token):

- `expired` (default) → expired items first (by frontmatter
  `expires_at`), then oldest-first by `date`. Surfacing expired items
  first is the whole point — they have aged out of the "act within a
  week" window and need a decision.
- `oldest` → oldest first by frontmatter `date`, ignoring `expires_at`.
- `newest` → newest first by frontmatter `date`.
- Ignored when explicit slugs are passed (the slug order wins).

Defaults:

- No arguments → `list expired`.
- A bare slug with no subcommand (`<slug>`) → `show <slug>`. Both
  default surfaces are read-only; triage is opt-in via `walk`.

Examples:

- `/followups` → list everything open, expired first.
- `/followups my-slug` → show that one item read-only.
- `/followups show my-slug` → same.
- `/followups walk` → triage the queue, expired first.
- `/followups walk newest` → triage newest first.
- `/followups walk a b c` → triage just those three items, in order.

## Gotchas

- **Follow-ups are not tasks.** This skill never promotes anything to a
  task — that concept does not exist in the Memento any more. If the
  user says "this is a real commitment," the action is to file it in
  the issue tracker and dismiss the follow-up. Surface the suggestion
  inline ("file as Jira ticket and dismiss?") rather than minting a
  local commitment file.
- **One item per turn (walk only).** Present a single follow-up at a
  time and wait for the decision before moving on. `list` and `show`
  are not interactive — print and exit.
- **Empty queue ⇒ stop.** If there are no open follow-ups, say so and
  exit. No commit.
- **Default to dismiss when expired and inert.** If a follow-up is past
  `expires_at` and the user has nothing to add, that is signal the
  item did not earn its place. Suggest dismiss, do not default to
  keep.
- **Default to keep when fresh and ambiguous.** Inside the active
  window, ambiguity defaults to keep — the user can revisit on the
  next walk.
- **Never push.** Local commit only, and only `walk` ever commits.

## Step 1: Build the worklist

Glob the queue:

```bash
ls "$MEMENTO_ROOT/sources/followups/"*.md 2>/dev/null
```

Read each file's frontmatter (`date`, `expires_at`, `rationale`, `origin`)
and the first `#` heading. Build:

```
date: YYYY-MM-DD
expires_at: YYYY-MM-DD (may be missing for legacy items)
slug: my-slug
title: First H1
path: sources/followups/<slug>.md
expired: true|false   # today > expires_at
```

Sort per the order modifier:

- `expired` → expired items first (oldest expiry first), then
  non-expired items oldest-first by `date`. Legacy items without
  `expires_at` are treated as expired if `date` is more than 14 days
  ago, otherwise treated as fresh and sorted oldest-first.
- `oldest` → oldest first by `date`.
- `newest` → newest first by `date`.

If explicit slugs were passed, the worklist is exactly those files in
the given order; resolve each slug as `sources/followups/<slug>.md`.
Error on any slug that resolves nowhere.

If the worklist is empty, print:

```
No open follow-ups.
```

and stop. Do not commit.

## Subcommand: list

After Step 1, print one line per item. Mark expired items with `!` so
they jump out at a glance:

```
<flag>  <date>  <expires>  <slug>                title
!       2026-04-12  2026-04-26  s3-egress-question     Why is S3 egress so high?
        2026-05-12  2026-05-26  prod-cred-rotate       Confirm prod cred rotate cadence
```

If there are expired items, prefix with a one-line summary so the user
sees the count:

```
8 open follow-ups (3 expired):
```

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

**<title>** — opened YYYY-MM-DD (N days ago)
<expiry line — see below>
File: sources/followups/<slug>.md
<origin field if present>
<rationale field if present>

<full body of the file — not a summary>
```

Expiry line shapes:

- Fresh: `Expires YYYY-MM-DD (in N days)`
- Expired: `EXPIRED YYYY-MM-DD (N days ago)`
- Missing `expires_at`: `No expiry set (legacy item)`

If the worklist has more than 10 items, tell the user the count up
front before the first render:

```
14 open follow-ups (6 expired). Walking expired-first. Say "stop" any
time to bail.
```

Then ask via `AskUserQuestion`. Options:

- `keep` — leave it; revisit next walk. For an expired item, also bump
  `expires_at` forward by 14 days (ask: "bump expiry?" — default yes,
  the user can decline to bump and just keep).
- `dismiss` — delete it. Default action for expired-and-inert items.
- `answer` — capture an answer or new context.
- `note` — append a dated `## Notes` entry without changing status.
- `file-and-dismiss` — the follow-up is really a commitment; ask the
  user to file it in their issue tracker, then delete the local
  follow-up. The skill never creates the upstream issue itself.
- `skip` — advance without deciding.
- `stop` — end the walk.

Wait for the answer. Take the action below. Then move on.

### keep / skip

Do nothing for the file. Move to the next item.

If the item was expired and the user said `keep` (without explicitly
declining the expiry bump), update `expires_at` to today + 14 days.

### dismiss

```bash
rm "$MEMENTO_ROOT/sources/followups/<slug>.md"
```

If the user gives a one-line reason, save it for the commit message.

### file-and-dismiss

Print a one-line "file this in <issue tracker>" prompt for the user,
including the title and rationale so they have the language to paste
in. After confirmation, delete the file:

```bash
rm "$MEMENTO_ROOT/sources/followups/<slug>.md"
```

Do NOT create the upstream issue from the skill. The Memento stays
out of the commitment-management business.

### answer

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

- Dismissed: N (slugs: ...)
- Filed-and-dismissed: N (slugs: ...)
- Answered: N (slugs: ...)
- Noted: N (slugs: ...)
- Kept: N (of which N expiries bumped)
- Skipped: N
- Remaining unwalked: N
```

If anything changed on disk, commit once at the end:

```bash
git -C "$MEMENTO_ROOT" add -- <touched-followup-and-note-files>
git -C "$MEMENTO_ROOT" commit -m "followups: review — <one-line summary>"
```

Stage **only the files this walk touched** (dismissals, expiry bumps, note
appends, and any answer-to-note files) — never `git add sources/followups/`
broadly, which would sweep a concurrent agent's untracked files into this commit.
`git add -- <path>` stages a deletion too, so dismissed items commit correctly.
Skip the commit if nothing changed. `list` and `show` never commit.

## Guidelines

- **One at a time (walk).** Do not present the whole worklist at once
  and ask for batched decisions. Walking is the point — it forces a
  decision per item. Use `list` if the user just wants to see what's
  open.
- **Show the full body (show / walk).** Items are usually short.
  Don't summarize — paste the body so the user has the same context
  that was captured originally.
- **Expired-and-inert items want dismissal.** The Memento is not a
  task tracker; the value of a follow-up is the user acting on it
  within the window. If the window has passed and nothing has
  happened, that is the answer.
- **Commitments belong in the issue tracker.** When a follow-up turns
  out to be a real commitment, the right move is `file-and-dismiss`,
  not "promote to task." There is no local promotion path.
