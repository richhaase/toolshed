---
name: ama
description: Read the wiki and interview the user to fill gaps, resolve contradictions, and capture context the LLM is curious about. Use when the user says "ama", "ask me anything", "what do you want to know", "interview me", "fill in gaps", "tell me what's missing", or otherwise wants the agent to actively pull knowledge into the Memento. Captures answers as a session source so /compile can fold them into the wiki.
argument-hint: "[<topic>]"
user-invocable: true
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion]
---

# Ask Me Anything

Read the Memento, find the highest-value gaps, and interview the user to
fill them. Captures the Q&A as a session source. The next `/compile`
folds the answers into the wiki.

This is the active-capture counterpart to `/fin`. Where `/fin` extracts
what already happened, `/ama` pulls knowledge that has not yet been
written down.

## Memento root

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
```

See `../_shared/references/memento-root.md` for the full resolution
contract. All `sources/`, `wiki/`, `private/`, and context paths below
are relative to `MEMENTO_ROOT`.

## Arguments

Arguments are passed as: $ARGUMENTS

- No arguments → broad survey across the hot set and `wiki/INDEX.md`.
- `<topic>` → narrow to one entity. Match against `wiki/INDEX.md` page
  names; if multiple match, ask which one.

## Gotchas

- **Never read `private/`.** Privacy boundary. Build the question list
  from `AGENTS.md`, `wiki/`, and `sources/` only.
- **One question per turn via `AskUserQuestion`.** No walls of questions.
  Adapt follow-ups based on each answer.
- **Empty plan ⇒ stop.** If the wiki is genuinely sparse and there are
  no high-value questions to ask, say so and exit. Do not invent
  questions to fill space.
- **Skip is free.** Users may say "don't know" or "not relevant" without
  penalty. Move on to the next question.
- **Never push.** Local commit only.
- **Do not auto-invoke `/compile`.** Tell the user to run it themselves
  after the interview. Cross-skill invocations stay user-driven.

## Step 0: Read Entity Types registry

Read the `## Entity Types` section from canonical `AGENTS.md`. Legacy
repos may have it in `CLAUDE.md`; fall back there. Note which entity
types have `private_notes: yes` — observations about those entities
route to `private/` instead of `sources/` in Step 5.

## Step 1: Survey the Memento

Read in parallel:

- `AGENTS.md` (full file — for the hot set tables and registry)
- `wiki/INDEX.md` (for the page list with `Last Updated` and pinned
  status)
- If a `<topic>` argument was given: the matching `wiki/<type>/<slug>.md`
  page. If no `<topic>`, sample 5–10 wiki pages — pinned pages first,
  then most recently updated.

Use Glob to spot entities mentioned across `sources/sessions/` and
`sources/notes/` that do not yet have a wiki page.

## Step 2: Build the candidate question list

Look for high-value gaps in this order:

1. **Sparse pages** — wiki pages with few sections filled or only one
   source. The page exists but is thin.
2. **Open questions** — explicit "Open Questions" sections in wiki
   pages that name unresolved items.
3. **Contradictions** — synthesized prose that hedges or contains
   competing claims about the same entity.
4. **Stale hot-set entries** — pages in the hot set whose `Last Updated`
   in `wiki/INDEX.md` is well behind today's date. Ask whether the
   stated facts still hold.
5. **Implicit entities** — names or topics that appear repeatedly in
   sources but have no wiki page of their own.
6. **Curiosity gaps** — places where the wiki mentions something
   without explaining the why. ("X chose Y" with no rationale, "Z is
   relevant" with no context.)

Score each candidate on impact (does it shape the hot set?) and
specificity (can the user answer in a sentence?). Prefer concrete
single-question prompts over open-ended ones.

Pick the top 3–5 candidates. If there are fewer than 3 worth asking,
that's fine — ask only the strong ones.

## Step 3: Interview

Run the interview through `AskUserQuestion`, one prompt at a time.

For each candidate:

- **Lead with context.** State the page, the gap, and what specifically
  is unclear. Keep this to one or two sentences.
- **Ask a focused question.** Use `AskUserQuestion`. Provide 2–4
  options when the answer is bounded; otherwise leave it open via the
  free-text path. Always include an implicit "skip" option.
- **Listen.** If the answer opens a more useful follow-up, ask it.
  Otherwise advance to the next candidate.

Examples of well-shaped questions (these are illustrative shapes, not
canned questions):

- "The page on [[<entity>]] lists three open questions; one is about
  X. Do you have an answer, or should it stay open?"
- "[[<person>]] appears in five session captures but has no wiki page.
  Want me to seed one — and if so, what role and relationship?"
- "Hot set says [[<topic>]] was last updated 47 days ago. Still
  current, or has it changed?"

Stop the interview when the candidate list is exhausted, when the user
says "stop"/"done"/"that's enough", or when answers stop being
substantive.

## Step 4: Plan the capture

Before writing, summarize what you heard:

```
Captured (N answers):
- <entity>: <one-line summary of the answer>
- ...

Skipped (N): <slugs the user passed on>
```

If every question was skipped, print "Nothing captured" and stop. Do
not create empty session files.

## Step 5: Write the capture

Build a single session source file:

```
sources/sessions/<YYYY-MM-DDTHHmmss>-ama-<slug>.md
```

Pick `<slug>` from the topic argument or from the dominant entity in
the answers. Use today's local date; format the timestamp as
`YYYY-MM-DDTHHmmss` (no separators in the time portion).

Frontmatter:

```yaml
---
date: YYYY-MM-DD
title: AMA — <slug>
type: ama
entities:
  - <entity-1>
  - <entity-2>
---
```

Body: a `## Q&A` section with one `### Q: ...` / `### A: ...` pair per
captured answer. Quote the user's answer verbatim — do not paraphrase
into a synthesized claim. The `compile` skill is responsible for
synthesis; AMA's job is faithful capture.

### Privacy routing

If an answer is an observation about an entity flagged
`private_notes: yes` in the registry (typical example: people), append
it to the configured `private/<filename-pattern>` path under a dated
heading instead of writing it into the session capture. Use the same
append-only rule fin uses — never overwrite. The session file is still
written for the non-private answers.

If every answer is private, write only to `private/` and skip the
session capture.

## Step 6: Commit

```bash
git -C "$MEMENTO_ROOT" add sources/ private/
git -C "$MEMENTO_ROOT" commit -m "ama: capture interview — <slug>"
```

If neither path has staged changes (everything was skipped), skip the
commit and report "no changes captured".

Hooks failing means the commit did not happen — fix the underlying
issue, re-stage, new commit. Never `--amend`.

## Step 7: Suggest next step

Tell the user:

```
Captured to sources/sessions/<filename>. Run /compile to fold these
answers into the wiki and refresh the AGENTS.md hot set.
```

Do not invoke `/compile` directly. The user decides when to recompile.

## Guidelines

- **Be specific, not exhaustive.** Five focused questions beat fifteen
  vague ones. The user's time is the bottleneck.
- **Prefer impact on the hot set.** Questions that update pinned pages
  or recently-updated pages have the highest ROI per answer.
- **Faithful capture, not synthesis.** Quote the user. Let `/compile`
  do the synthesis pass.
- **Don't ask the same question twice.** Check `sources/sessions/` for
  prior AMA captures on the same topic; skip questions already
  answered.
