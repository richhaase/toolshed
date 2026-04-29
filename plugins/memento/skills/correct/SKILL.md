---
name: correct
description: >-
  Fact-level correction across Memento sources. Use when the user states a
  specific factual claim is wrong ('X is NOT Y, actually Z', 'we got X wrong
  everywhere it appears', 'the claim that ... is incorrect', 'fix the fact
  that...') and that wrong claim has propagated to multiple sources/**/*.md
  files. Surgical in-place edits at every callsite; refuses vague rewording
  asks. Use this whenever a user is correcting a specific factual claim in
  Memento sources rather than asking to rewrite, restyle, or archive material.
argument-hint: "<wrong claim -> right claim>"
user-invocable: true
allowed-tools: [Read, Edit, Glob, Grep, Bash]
---

# Correct

Apply a stated factual correction to every source file that carries the wrong
claim, in-place. Sources are the truth layer; once they're correct, `/compile`
rebuilds the derived surfaces.

## When this skill applies

Use when the user states a clear factual correction with both halves of the
pair:

- "Maya is NOT the Postgres on-call — Sam owns that rotation."
- "PROJ-123 is owned by Jordan, not Alice."
- "The prod cutover is May 15, not May 8."

The user's input must decompose into a `(wrong claim → right claim)` pair. If
it doesn't, ask for the missing half rather than guess. A confident wrong claim
is the whole basis for the skill — without it, this is just rewriting.

## When this skill does not apply

- **Vague rewording asks** ("make this clearer", "rewrite this section",
  "tighten the prose"). Decline. Source files are the durable record; style
  edits don't belong here.
- **Document-level supersession** ("this whole session log is wrong, replace
  it"). Edit the source's frontmatter directly to set `status: superseded` /
  `status: archived` with `superseded_by` / `archive_note` — `compile` and
  `health-check` honor those fields. There's no separate skill for that;
  it's a hand edit.
- **Capturing a brand-new fact** with no incorrect predecessor in sources. Add
  it via `fin` at session end, or write directly under `sources/notes/`.
- **Edits to derived surfaces.** `wiki/` and `AGENTS.md` are not editable
  here. They're regenerated from sources by `/compile`. Even when the wrong
  claim is staring back from a wiki page, fix it at the source — the wiki
  page will catch up on the next compile.

## Memento root

Resolve the Memento data root before reading or writing:

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
../_shared/scripts/memento-run pwd
```

All paths below are relative to `MEMENTO_ROOT`.

## Architecture rule

`wiki/` and `AGENTS.md` are derived. **Only `/compile` writes them.** This
skill writes only under `sources/`. Do not touch `private/` — that directory
is a privacy boundary owned by the user, not by automated correction flows.
If a wrong claim appears in `private/`, surface it in the report and let the
user decide.

## Workflow

### Step 1: Restate the correction

Echo the correction back as a sharp `(wrong → right)` pair before doing
anything else. This is the contract for the rest of the run.

```
Wrong: Maya is the Postgres on-call / "page Maya for any Postgres incident"
Right: Sam owns the Postgres on-call rotation; Maya is not the right contact
       for Postgres incidents.
```

If the user gave only the wrong claim or only the right claim, ask for the
missing half. Do not infer.

### Step 2: Find callsites

Search `sources/` for the central entity/topic terms from the wrong claim. The
goal is to surface every passage that carries the wrong claim — not every
passage that mentions the entity. The same person can appear correctly in many
unrelated facts, so a bare entity grep over-matches.

```bash
../_shared/scripts/memento-run rg -n --no-heading 'Maya.*Postgres|page Maya|postgres on-call' sources/
```

For each candidate file, read enough context to decide whether the match is
the wrong claim or an unrelated mention. Skip:

- Source files whose frontmatter says `status: superseded` or
  `status: archived` — they're already excluded from current synthesis.
- Files where the entity appears in an unrelated fact (e.g., "Maya approved
  the budget request" is a different fact and stays as-is).

If no callsites remain, report "no source callsites carry this claim" and
stop. Suggest the user check whether the claim lives only in `wiki/` (in
which case `/compile` after the next source change is what closes the loop)
or only in `private/` (out of scope for this skill).

### Step 3: Build the diff

For each callsite to fix, propose a unified before/after. Group by file. Show
the user the entire change set in one review — corrections are easier to
judge as a whole than one at a time.

Per-file format:

```
sources/sessions/2026-03-10T1400-incident-review.md:56
- - **Page Maya** — for any Postgres incident or pager escalation.
+ - **Page the Postgres on-call rotation** (Sam currently owns it) for any incident or pager escalation.
```

Preserve surrounding text, structure, and frontmatter. Rewrite only the
passage that carries the wrong claim. If a passage needs a larger touch to
read naturally after the correction, prefer a minimal local rewrite over a
broader rewrite — the goal is correctness, not style.

Do not write anything in this step. The diff is a proposal.

### Step 4: Approval gate

Print the full proposed change set and stop. Ask explicitly:

> Apply these N edits across M source files? (yes / no / partial)

Wait for an unambiguous `yes`. On `partial`, take direction on which files or
edits to skip, then re-show the trimmed plan and ask again. On `no` or
anything ambiguous, do not write. The gate exists because over-correction
damages the source record — silent edits to history are worse than the
original error.

### Step 5: Apply edits

For each approved edit, use `Edit` with the exact `old_string` from the
proposal and the new text. Preserve everything outside the corrected passage.

If a single source has multiple corrected passages, issue all `Edit` calls in
one message so they apply together. Do not add `correction_note` frontmatter
by default — the diff plus the commit message are the durable record.

### Step 6: Optional historical note

If the wrong claim originated in one specific session source (commonly a
legate session log) and the user wants the history preserved with a pointer,
offer to add a brief `correction_note` field to that one file's frontmatter.
Skip this by default; most fact corrections don't warrant the metadata churn.

### Step 7: Commit

Detect git context and commit when applicable:

```bash
git -C "$MEMENTO_ROOT" rev-parse --is-inside-work-tree 2>/dev/null
```

If inside a work tree:

```bash
git -C "$MEMENTO_ROOT" add sources/
git -C "$MEMENTO_ROOT" commit -m "correct: <one-line correction summary>"
```

Skip cleanly when not in a git repo or when nothing is staged.

### Step 8: Recommend /compile

`wiki/` and `AGENTS.md` were synthesized from the sources you just edited and
likely still carry the wrong claim verbatim. End the run by recommending
`/compile`:

> Source edits applied. Run `/compile` to refresh the wiki and hot set with
> the corrected fact.

Do not run `/compile` from this skill. The user decides when the wiki
rebuild is worth the time.

## Output

Report:

- The `(wrong → right)` pair as restated.
- Files searched and number of candidate matches.
- Files edited with passage count per file.
- Files skipped with one-line reasons (e.g., "unrelated mention",
  `status: superseded`, "lives only in private/").
- Commit SHA, or `commit: skipped (not a git repo)` /
  `commit: skipped (no changes)`.
- The recommended next step (`/compile`).

## Guidelines

- **Surgical edits, not rewrites.** Touch only the passage that carries the
  wrong claim. If the surrounding paragraph reads awkwardly after the change,
  a minimal local fix is fine; a stylistic rewrite is not.
- **Truth at the source.** Sources are the only writable surface for this
  skill. `wiki/` and `AGENTS.md` are derived; `private/` is owned by the
  user.
- **Tight approval gate.** Always show the diff first, always wait for an
  explicit `yes`. Never auto-apply, even when the correction looks obvious.
- **Refuse vague asks.** If you cannot state a `(wrong → right)` pair from the
  user's input, ask for it. Do not infer the wrong claim from context.
- **One correction per run.** If the user states multiple unrelated factual
  corrections, run the skill once per pair so each gets its own diff and
  approval gate.
