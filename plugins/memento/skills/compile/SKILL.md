---
name: compile
description: Use when the user says "compile", "update the wiki", "build wiki", "compile wiki", or wants to refresh the memory base. Reads sources/**/*.md and synthesizes into wiki/ organized by topic/entity, then refreshes the AGENTS.md hot set. First run builds full wiki; subsequent runs do incremental updates. Not for browsing open items (see `followups`), closing a session (see `save`), or filling gaps (see `ama`).
argument-hint: "[full|<topic>]"
user-invocable: true
allowed-tools: Read Write Edit Glob Grep Bash Agent
---

# Wiki Compiler

Compile all sources into a topic-organized wiki. Each wiki page covers one entity,
organized by entity type as defined in the canonical `AGENTS.md` Entity Types
registry. Repos with only a full `CLAUDE.md` Memento context must be migrated
with `memento-config` before compile runs; `CLAUDE.md` should be only a thin
Claude Code entrypoint that points to `AGENTS.md`. Pages accumulate knowledge
over time — this is additive, not destructive.

## Memento root

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
```

See `../_shared/references/memento-root.md` for the full resolution contract.
All Memento paths below (`sources/`, `wiki/`, `AGENTS.md`) are relative to
`MEMENTO_ROOT`.

## Arguments

Arguments are passed as: $ARGUMENTS

- No arguments → incremental update (compile changes since last run)
- `full` → full rebuild (recompile everything from scratch)
- `<topic>` → recompile a single wiki page (e.g., `compile auth-service`, `compile jane-doe`)

## Gotchas

Hard rules — environment-specific facts the agent will get wrong without these.

**Safety:**
- **NEVER read files in `private/`** — that directory is a privacy boundary, and reading it can surface content the user has explicitly walled off from synthesis.
- **NEVER write files outside `wiki/` and `AGENTS.md`** — sources are read-only inputs; writing back into `sources/` corrupts the audit trail the wiki is derived from. One narrow exception: the **Step 7.5 eval gate**, whose `eval-score` tool writes its own telemetry under `sources/eval/runs/` and (on a gate fail) a defect follow-up under `sources/followups/` — operational records the scorer owns, never synthesis inputs. The compile agent itself still writes only `wiki/` + `AGENTS.md`.
- **All Memento paths are relative to the resolved Memento root** — `sources/`, not the caller's current repo.
- **Only active sources shape current state.** Treat source files with no `status`
  frontmatter as `active`. Exclude files marked `status: superseded` or
  `status: archived` from current-state synthesis and from L1 hot-set promotion,
  but preserve them in source traces when an active source's `supersedes` field
  points to them.
- **Projected sources cache live state — never promote their mutable state as standing truth.**
  A source with `cache: projection` frontmatter (a provider sync over an external
  system of record) is not authority for current state; its `source_of_truth`
  system is. Compile its *events* (dated, immutable — "merged on D", "moved to
  done on D") as durable record like any captured source. Compile its *state*
  (mutable status — "open", "in progress") only with an explicit `as of <as_of>`
  qualifier, and never as a bare present-tense fact in `wiki/` or the L1 hot set.
  Current state is resolved by refreshing the source, not by reading the cache —
  so wiki/hot-set entries derived from projected sources point to the live system
  for status rather than asserting it.
- **Always create new commits — never `--amend`.** Pre-commit hook failure
  means the commit didn't happen; fix the issue, re-stage, new commit.
- **The skill commits locally only — never push.** Pushing is the user's call.
- **For recurring/scheduled compile, use the harness-native scheduler — don't
  hand-roll a polling loop.** In Claude Code that may be a Routine or
  `CronCreate`; in Codex use automations/reminders when available. This skill
  owns only the compile semantics.

**Performance — speed is a hard constraint:**
- **Batch reads in one message — this runs them concurrently.** 17 source
  files = ONE message with 17 Read tool calls, not 17 messages. Same rule
  for Glob/Grep when you have a known list of paths.
- **Batch writes in one message.** Same rule for Edit/Write — issue the
  full set of updated pages in one parallel batch.
- **Fan out substantive page synthesis — don't generate many pages serially in
  one context.** Batched tool calls parallelize I/O, not the model's token
  generation. Writing several substantively-merged pages back-to-back in a
  single context is serial and is the dominant latency on a multi-page
  incremental. Once Step 3 fixes the affected set, hand each substantive page to
  its own subagent and launch them concurrently (see Step 4, "For incremental
  updates"). Cheap activity-log appends stay inline — they have no synthesis to
  parallelize.
- **Read only what's affected.** Skip wiki pages for entities not mentioned
  in the changed sources. Keep `AGENTS.md` in context once read; don't
  re-read it.
- **Activity-log appends use one targeted `Edit`, never a full-page `Write`.**
  Re-emitting a whole accumulated page to add one dated activity line is the
  top output-token sink on heavy-activity days (a sync digest naming many PR
  authors fans a one-line append across every person page) — see Step 4.
- **Target: under 3 minutes for incremental compiles.** If you're slower,
  you're sequential where you should be parallel.

**Output:**
- **`last_compiled` lives only in `wiki/INDEX.md`** — never in per-page
  frontmatter. Page-level freshness is the `Last Updated` column in INDEX.md.
- **No `<!-- Compile run ... -->` HTML comments in INDEX.md.** The git log is
  the durable record. Step 8's commit message carries the synthesis.
- **`build-graph` (Step 5.6) is fail-open.** It writes nothing; on a nonzero exit,
  warn, skip the Step 7 rediscovery block, and keep going. It never blocks or rolls
  back a compile — the asymmetry against the fail-closed eval gate, because the graph
  guards no hard invariant.
- **The `<!-- REDISCOVERY START/END -->` markers are maintained like the HOT SET
  markers** — regenerated each compile, never hand-edited, always nested inside the
  HOT SET markers. Compile runs a render-time balance check and omits the block on
  imbalance; a malformed pair makes the eval gate fail-closed.

## Source status metadata

Memento sources may include YAML frontmatter:

```yaml
---
status: active|superseded|archived
supersedes:
  - sources/path-to-old-source.md
superseded_by: sources/path-to-new-source.md
archive_note: "Why this no longer represents current state"
correction_note: "What changed and why"
---
```

Rules:
- `active` is the default.
- `superseded` means a newer source replaces this source for synthesis.
- `archived` means preserve for history, but do not use for current synthesis.
- `supersedes` and `superseded_by` may be a scalar or list; normalize them as
  source-relative paths when checking traceability.

## Step 0: Read Entity Types registry

Read `AGENTS.md` and parse the `## Entity Types` section. This tells you:
- What entity types exist (people, projects, customers, topics, etc.)
- Where each type's wiki pages live (`wiki_path`)
- What filename pattern to use (`filename`)
- What frontmatter fields each type needs (`frontmatter`)
- What sections each type's wiki pages should have (`sections`)

If `AGENTS.md` is missing or lacks an Entity Types registry, stop and tell the
user to run `memento-config` to migrate or repair the Memento root. Do not
compile from a legacy `CLAUDE.md` registry; `CLAUDE.md` is a thin harness
entrypoint, not the canonical cache surface.

## Step 1: Determine scope

Run `date '+%Y-%m-%d'` to get today's date.

Capture the HEAD SHA observed at compile-start — this is the baseline the next
incremental run will diff against. Record it now so Step 6 can write it to
INDEX.md after the wiki is rebuilt:

```bash
COMPILE_BASE_SHA="$(git -C "$MEMENTO_ROOT" rev-parse HEAD 2>/dev/null || echo "")"
```

Check if `wiki/INDEX.md` exists:
- If it **does not exist** → treat as a full build regardless of arguments.
- If it **does exist** → determine the change set per the rules below.

### Change detection (incremental, git-backed Memento)

When `COMPILE_BASE_SHA` is non-empty (the Memento is a git working tree), use
git as the change-detection source of truth. Read `last_compile_commit` from
INDEX.md frontmatter and apply these rules:

- **Field missing, empty, or not a 40-char hex SHA** → full build. Write the
  field on success (backfill path for legacy INDEX.md files compiled before
  this skill tracked SHAs).
- **`git cat-file -e <sha>^{commit}` fails** → full build, log the reason
  (stale, rebased away, or the clone is shallow and doesn't carry the commit).
- **Otherwise** → the change set is the union of three queries against
  `sources/`:
  ```bash
  # Committed changes since baseline (rename-aware, drops deletes).
  git -C "$MEMENTO_ROOT" diff --name-only --diff-filter=AMR -M \
    "$last_compile_commit"..HEAD -- sources/
  # Unstaged working-tree changes.
  git -C "$MEMENTO_ROOT" diff --name-only HEAD -- sources/
  # Untracked files honoring .gitignore.
  git -C "$MEMENTO_ROOT" ls-files --others --exclude-standard \
    sources/
  ```
  The read loop must guard each path with `[ -f "$path" ]` so deletes that
  slip through (e.g., a rename's old path) are skipped safely rather than
  erroring on the Read.

### Change detection (incremental, non-git Memento)

When `COMPILE_BASE_SHA` is empty, fall back to filesystem mtime — this is the
legacy path and stays supported for scratch dirs and non-git Mementos:

```bash
# Find source files modified after last compile across ALL of sources/ — a hardcoded
# dir list silently misses new top-level source dirs. Exclude sources/eval/ (eval
# fixtures + run telemetry) and sources/trajectories/ (session telemetry for the
# learning loop) — neither is a synthesis input.
../_shared/scripts/memento-run find sources -name '*.md' -newer wiki/INDEX.md -not -path 'sources/eval/*' -not -path 'sources/trajectories/*' 2>/dev/null
```

After reading changed files (either path), discard sources whose frontmatter
status is `superseded` or `archived`. If no active source files remain, report
"wiki is current — no active source changes since last compile" and stop.

## Step 2: Gather all sources

### For incremental updates

1. Use the change set from Step 1 (git-diff union or mtime fallback) as the list of changed source files. **Exclude `sources/eval/`** (eval fixtures + run telemetry) **and `sources/trajectories/`** (session telemetry for the learning loop) — neither is knowledge to synthesize.
2. **In a single message**, issue parallel Read calls for ALL changed source files AND `wiki/INDEX.md`. This is one batch — not sequential reads. Guard each path with `[ -f "$path" ]` so rename-old-paths and deletes are skipped instead of failing the Read.
3. Run Step 3 on the gathered sources to identify affected entities (honoring per-source `touches` frontmatter where present).
4. **In a single message**, issue parallel Read calls for ALL affected wiki pages that need updating.

### For full builds

Use Glob to find all files in each source directory, **excluding `sources/eval/`
and `sources/trajectories/`** (telemetry channels, not synthesis inputs). Then
read them in parallel batches (max ~20 Read calls per message to stay within tool
limits). Parse frontmatter first and compile only active sources. Keep a list of
skipped superseded/archived sources for the final report.

## Step 3: Extract mentions and build entity graph

Scan all gathered source content and extract mentions of entities, classified by type
from the Entity Types registry. Build a mapping:

`entity type → entity name → [list of source files that mention it]`

Also detect **new entities** not yet tracked — if a topic or name appears 3+ times
across sources, it likely deserves its own page. Assign it to the most appropriate
entity type.

**Per-source `touches` short-circuit.** If a source's frontmatter declares
`touches: [entity-name, ...]`, treat that list as the canonical affected
set for that source and skip the scan on its body. The field is a one-way
read — compile consumes it when present, never writes it. Writers (sync
skills or hand-authored sources) opt in by emitting `touches` themselves;
compile must not require it, must not modify sync skills to produce it, and
must not special-case any specific source by name. Sources without
`touches` fall back to the scan above, unchanged.

**Per-source `<provider>_users` enrichment maps.** Sources may emit a
frontmatter map keyed `<provider>_users: { Full Name: <stable-id> }` —
e.g., `slack_users:`, `github_users:`, `linear_users:`. Each entry declares
that the named person has a known stable identifier in that provider, and
Step 4 uses these maps to enrich `wiki/people/*.md` frontmatter (see the
person-enrichment merge rule in Step 4). Like `touches:`, this is a one-way
read — compile consumes the field when present, never writes it back to
sources. Writers opt in by emitting the map themselves; compile must not
require it and must not special-case any specific provider name. Sources
without the field are unaffected.

## Step 4: Compile wiki pages

### For incremental updates

Once Step 3 fixes the affected-page set, the pages are independent units of work —
synthesizing them one after another in a single context is serial token generation and the
dominant latency on a multi-page run. Split the set by work type and parallelize the
expensive half:

**Class A — activity-log appends.** Pages whose only change is one or more dated lines at
the top of a `Recent Activity` / `Activity Log` section (PR-author activity, meeting
attendance, incidental mentions). Each is a single targeted `Edit` with no synthesis. Do
all of them inline in one parallel batch of `Edit` calls — a subagent's spin-up costs more
than a one-line insert saves.

**Class B — substantive synthesis.** New pages, pages with >2 changed non-activity
sections, complex state merges, person-enrichment merges. Each Class-B page is an
independent synthesis unit. **When there are 3 or more, fan them out — one subagent per
page (or one per same-type batch), issued in a single parallel batch so they run
concurrently.** With 2 or fewer, synthesize inline; the fan-out overhead isn't worth it.
The write phase then tracks the slowest single page, not the sum of all of them.

Each Class-B subagent receives the entity name, its entity-type definition (wiki_path,
filename, frontmatter, sections), the relevant source excerpts, and the current page
content. It synthesizes and **writes its own page**, then returns a one-line summary
(sections touched, any `<provider>_id` drift to surface). It must NOT read `private/`, must
NOT touch any page but its own, and must NOT run cross-linking, the hot set, the eval gate,
or the commit — those stay with the orchestrator, which runs them after every subagent has
returned. Pages are partitioned one-per-subagent, so there are no concurrent writes to the
same file and no worktree isolation is needed; INDEX.md and AGENTS.md are written only by
the orchestrator.

**Class-B subagent brief template:**
```
Compile a single wiki page for entity "<name>" (type "<type>").

Entity type definition:
- wiki_path: <path>
- filename: <filename>
- frontmatter fields: <fields>
- sections: <sections>

Current page content (merge into, do not discard accumulated sections):
<current page body, or "NEW PAGE" if none exists>

Source material for this entity:
<relevant source excerpts>

Synthesize the update and WRITE the page to <wiki_path>/<filename> following the
per-page write mechanics (Write vs targeted Edit, capped activity sections). Do NOT
read private/. Do NOT touch any other page, INDEX.md, or AGENTS.md. Return a one-line
summary: sections touched + any <provider>_id drift.
```

The per-page write mechanics below apply to every page written — the inline Class-A batch
and each Class-B subagent alike.

**Hard cap on affected pages.** A typical incremental run (≈13 changed sources)
should touch fewer than 25 wiki pages. If you're loading more than that, you're
over-reading — re-check the entity-graph from Step 3 and prune entities that
were only incidentally mentioned (passing reference, no new content).

**Activity-log appends are always a single targeted `Edit`, never a `Write` — this
is the dominant incremental case and the #1 source of wasted output tokens.** When
the only change to a page is a new dated entry in its `Recent Activity` / `Activity
Log` section (e.g. PR-author activity from a sync digest fanning across many person
pages), insert the new line(s) at the top of that section with one `Edit`. Do not
regenerate the page body. Being *named* as a PR author or meeting attendee is
incidental activity, not substantive new state — append the one-line entry and touch
nothing else on that page unless its other sections genuinely changed. Regenerating a
150-line person page to land one activity line is exactly the cost this rule kills.

**Otherwise, prefer `Write` over multi-`Edit` when >2 *substantive* sections change.**
Chained Edits incur diff-search overhead and emit the surrounding context tokens for
each hunk. When a page needs updates to more than two distinct non-activity sections
(Current State, Current Focus, Key Decisions, …), rewrite the whole page with a single
`Write` call — one full write costs fewer output tokens than 3+ Edits. Use targeted
`Edit` for narrow updates (one or two sections, frontmatter tweaks, or any activity-log
append per the rule above).

**Cap accumulating sections.** `Recent Activity` / `Activity Log` sections keep
the last 30 days inline. Older entries collapse to one-line per-week summaries
(or per-month, for entries older than 90 days). The full source files remain
under `sources/` for re-derivation if deeper history is ever needed — the wiki
is a synthesized view, not an archive. This periodic collapse of aged entries is
the *only* time an activity section warrants a full `Write`; routine top-of-section
appends never do.

### For full builds

Use the harness's background-agent/subagent primitive when available and launch
one worker per entity type. In Claude Code this is the `Agent` tool; in Codex
use the available multi-agent/background-thread primitive when present. If the
harness has no subagent surface, compile the entity types in the main session in
bounded parallel read/write batches instead. Each worker:
1. Receives all source content relevant to its entity type
2. Receives the entity type definition from the Entity Types registry (wiki_path, filename, frontmatter, sections)
3. Compiles all pages for that type in parallel

This gives you N-way parallelism where N = number of entity types.

**Agent brief template:**
```
Compile wiki pages for entity type "<type>".

Entity type definition:
- wiki_path: <path>
- filename pattern: <pattern>
- frontmatter fields: <fields>
- sections: <sections>

Entities to compile: <list of entity names with their source files>

Write each page to <wiki_path>/<filename> using the template below.
Do NOT read private/. All content must come from the provided source data.
```

### Wiki page template

See `references/templates.md` for the full page template and a worked
example. Key invariants: frontmatter fields come from the entity type
definition; do **not** add `last_compiled` or `compile_pass` to per-page
frontmatter — page-level freshness lives only in the `Last Updated` column
of `wiki/INDEX.md`.

### Writing pages

For each entity to compile:

1. **Existing page** — Read current content, merge new information. Update dynamic sections (Current Focus, Current State, Recent Activity). Never delete accumulated sections (History, Key Contributions, Key Decisions) unless the prior source is explicitly superseded or archived; in that case, move it to history/corrections prose rather than current-state prose. Update the `sources` frontmatter array with active source files used for the current synthesis. Do NOT add or update `last_compiled`/`compile_pass` — that data belongs only in INDEX.md.

2. **New page** — Generate from template. Fill in from source material. Sparse pages are fine — they'll fill in over subsequent compiles.

3. **Person enrichment merge.** For each `wiki/people/<slug>.md` being written (existing or new), scan the gathered sources' frontmatter for any `<provider>_users:` maps (Step 3) and look up the page's full name against each map's keys. For every hit, set the corresponding `<provider>_id: <stable-id>` field in the page's frontmatter — *only* when the field is currently absent or already equal. Never overwrite a manually-set value: if the existing value differs from the source map, leave it and surface the drift in the post-compile report. The entity-type registry must declare the `<provider>_id` field on the person row for it to be emitted; entries from a provider not declared in the registry are ignored.

4. Write pages in parallel where possible.

## Step 5: Cross-link pages

After all pages are written, ensure cross-links are consistent:

- Every `[[page-name]]` reference should correspond to an actual wiki page.
- Add cross-links in prose where entities are mentioned (e.g., "Working with [[jane-doe]] on [[api-migration]]").
- Update `related` frontmatter arrays to reflect actual cross-references.

## Step 5.5: Reconcile Evidence References

After page writes and cross-link cleanup, run the deterministic evidence-reference
reconciler before rebuilding `INDEX.md` and `AGENTS.md`:

```bash
node ../_shared/scripts/reconcile-evidence-refs --root "$MEMENTO_ROOT"
```

The reconciler only edits generated public cache surfaces under `wiki/` by
default. It rewrites legacy `sources/sync/...` paths to `sources/syncs/...` when
the moved source exists, removes citations to paths that no longer exist, and
leaves synthesized prose intact. This is the garbage-collection pass for stale
evidence references left by source renames, projected-source retirement, task
queue deletion, or follow-up triage.

If the run reports removed references, include the count in the compile report.
Do not treat removed references as source data; they were unverifiable cache
citations. If the script cannot run, stop before Step 6 rather than writing a new
index over a known-stale citation graph.

## Step 5.6: Build connection graph (fail-open)

After reconcile, recompute the current-state connection graph — reverse edges plus
per-page in-degree over the `[[wikilinks]]` + `related:` the wiki already carries —
so Step 7 can surface proactive rediscovery and on-demand backlink/neighbor queries
have a substrate. The script writes nothing.

```bash
node ../_shared/scripts/build-graph --root "$MEMENTO_ROOT" --json > /tmp/memento-graph.$$.json
```

**Fail-open** (the asymmetry against the Step 7.5 fail-closed eval gate — the graph
guards no hard invariant): on a nonzero exit, log a warning, skip the Step 7
rediscovery block for this run, and continue. Knowledge must still compile and commit.
See `../_shared/references/connection-graph.md` for the current-state edge rule, the
L3-derived staleness signal, and the query modes.

## Step 6: Build INDEX.md

Write `wiki/INDEX.md` with a catalog of every wiki page, grouped by entity type.
The INDEX tracks pinned status — pages marked as pinned always appear in the
`AGENTS.md` hot set regardless of recency.

Preserve the existing `pinned` list from the INDEX.md frontmatter — don't drop
manual pins. Add any new pages to the table but don't auto-pin them. Likewise
preserve the `rediscovery_recent` list (the bounded rotation cursor Step 7
advances); a full INDEX rewrite must not drop it.

INDEX.md is the wiki's single source of compile metadata: it carries
`last_compiled` (date) and `last_compile_commit` (the `COMPILE_BASE_SHA`
captured at the start of Step 1) in its own frontmatter, plus a
`Last Updated` column per page row. Update all three on every successful
compile. `last_compile_commit` is the baseline the next incremental run
diffs against; recording the start-of-run SHA (not a post-commit SHA) keeps
the semantics clean — if Step 8 is skipped (no changes, not a git repo), the
field still describes the tree the wiki was synthesized from. Omit
`last_compile_commit` only when the Memento is not a git working tree.

**Do NOT append `<!-- Compile run ... -->` HTML comments to INDEX.md.** The git
log is the durable record of what each compile pass did; the inline log
duplicated that and grew unboundedly. The skill commits its work as its final
step (Step 8), and the commit message carries the synthesis that used to live in
the comment.

See `references/templates.md` for the INDEX.md template. Per-type columns
come from the key frontmatter fields defined in the Entity Types registry,
plus Summary, Last Updated, and Pinned.

## Incremental update behavior

When running incrementally (not a full build):

1. Capture `COMPILE_BASE_SHA` from `git rev-parse HEAD`, read `last_compile_commit` from INDEX.md, and resolve the change set (git-diff union when both SHAs are valid, mtime fallback when the Memento is not a git repo). If empty, stop — wiki is current.
2. **Read ALL changed source files in one parallel batch.** Honor any `touches` frontmatter to skip mention-extraction on those sources.
3. Extract entity mentions by type for sources without `touches`. Build the list of affected wiki pages.
4. **Read ALL affected wiki pages in one parallel batch.**
5. Partition the affected pages (Step 4): activity-log appends (Class A) go inline as one parallel batch of `Edit` calls; substantive pages (Class B) fan out to concurrent subagents when there are 3+, each writing its own page. Wait for all subagents to return.
6. Run Step 5.5 evidence-reference reconciliation, then Step 5.6 `build-graph` (fail-open), then **write INDEX.md (with `last_compile_commit: $COMPILE_BASE_SHA`, preserving `pinned` and `rediscovery_recent`).**
7. **Read `AGENTS.md`, rebuild the hot set between markers, render the additive `<!-- REDISCOVERY -->` sub-block from the graph, advance the `rediscovery_recent` cursor, write `AGENTS.md`.**
8. Do NOT delete or rewrite content from prior compiles — this is additive. Update dynamic sections with latest data; preserve accumulated sections. Do NOT append `<!-- Compile run ... -->` HTML comments anywhere; the commit (Step 8) is the durable record.
9. **Eval gate + commit (Steps 7.5 → 8).** Run `eval-score --gate` before committing; on `verdict: fail` (or scorer error) roll back `AGENTS.md` + `wiki/` to `COMPILE_BASE_SHA` and do NOT commit. Otherwise commit (staging `wiki/`, `AGENTS.md`, and `sources/eval/runs/`). Always the last action; skip cleanly when not a git repo or nothing staged.

The entire incremental compile should be **5-6 orchestrator roundtrips**: resolve change set → read sources → read wiki pages → write wiki updates (Class-A append batch + a single concurrent Class-B subagent dispatch) → write INDEX + L1 hot set → commit. The Class-B subagents run in parallel within that one dispatch, so wall-clock tracks the slowest page, not the page count.

## Step 7: Distill L2 -> L1 (`AGENTS.md` hot set)

After the wiki is updated, rebuild the dynamic hot set section in canonical
`AGENTS.md`. `CLAUDE.md` should be a thin harness entrypoint that points to
`AGENTS.md`; do not duplicate the hot set into it.

### How it works

1. Read `wiki/INDEX.md` — get the full page list with `Last Updated` dates from
   the per-type tables and the `pinned` list from frontmatter. INDEX.md is the
   only place that holds page-level freshness data; do not look for
   `last_compiled` in per-page frontmatter.
2. Read `AGENTS.md` and find the markers `<!-- HOT SET START -->` and `<!-- HOT SET END -->`.
3. Build the hot set:
   - **All pinned pages** go in, regardless of recency.
   - **Most recently updated pages** fill remaining slots, sorted by INDEX `Last Updated` descending.
   - **Cap per entity type**: max 5 entries per type (configurable, start simple).
   - **Total cap**: ~20 entries across all types. The hot set must stay small.
4. For each entry, write one row: name, one-line summary, link to wiki page.
5. Replace everything between the HOT SET markers in `AGENTS.md` with the new tables.
6. **Rediscovery block (additive — old-but-still-linked pages recency would never
   surface).** From the Step 5.6 graph, compute the picks:
   ```bash
   node ../_shared/scripts/build-graph --root "$MEMENTO_ROOT" --rediscover \
        --exclude "$EXCLUDE" --cold-days 60 --k 2 --json
   ```
   where `$EXCLUDE` is the comma-joined union of pinned pages, the slugs already in
   the recency hot set, and INDEX `rediscovery_recent`. Render the returned picks
   (≤2, ≤1 per type) as a sub-block **inside** the HOT SET markers, wrapped in
   `<!-- REDISCOVERY START -->` / `<!-- REDISCOVERY END -->`, one row each (name,
   why-surfaced, wiki path). This is **additive headroom** — NEVER carved from the
   per-type (≤5) or total (~20) recency/pins budget, so a pick can never evict a
   load-bearing row, which is exactly what keeps Step 7.5 from rolling back over a
   rediscovery pick. If Step 5.6 failed or there are no picks, render NO block
   (absent markers → the eval gate treats them as a no-op). Balance-check the
   rendered markers (one START before one END, inside the HOT SET region); on
   imbalance, omit the block.
7. **Advance the rotation cursor.** Prepend the chosen slugs to `wiki/INDEX.md`
   frontmatter `rediscovery_recent` (FIFO, capped at depth 4) with one targeted
   `Edit`, so the same pages don't squat the slot across compiles.

### Hot set format

See `references/templates.md` for the hot-set markdown shape.

### Safety

- **Only modify content between the markers.** Never touch anything outside them.
- If the markers don't exist in `AGENTS.md`, append them at the end of the file and
  then write the hot set.
- Do not append hot set markers to a thin `CLAUDE.md` file when `AGENTS.md`
  exists.
- The hot set is fully regenerated each compile — it's not an incremental edit.
- **The `<!-- REDISCOVERY START/END -->` block, when present, nests inside the HOT
  SET markers and is regenerated with the hot set.** Keep it balanced (one START,
  one END, START first); on any imbalance, omit it — an unbalanced pair makes the
  eval gate refuse to certify.

## Step 7.5: Eval gate (Gate-0) + rollback — the keystone interlock

Before committing (Step 8), verify the freshly-compiled answer surface still
answers the committed golden-query fixtures. This is the gate that protects the
always-resident `AGENTS.md` hot set and named wiki answer pages from a compile
that silently drops or corrupts a load-bearing fact. **Mechanical,
deterministic, node, ~0 tokens — no LLM judge in this path.** If there are no
scored regression fixtures, report `verdict: ungated`: commit may proceed, but
the run was not protected by Gate-0.

### Run the scorer

From the skill's base directory (same convention as the `../_shared/scripts/memento-root`
call in Step 1), run the shared node scorer with `--gate` and capture its JSON verdict:

```bash
node ../_shared/scripts/eval-score --root "$MEMENTO_ROOT" --gate --json > /tmp/memento-eval.$$.json
rc=$?
```

`eval-score` needs only `node` (available in the Claude Code / Codex runtimes).
It reads `sources/eval/fixtures/{regression,capability}.json` +
`sources/eval/verdict-contract.json`, validates that every
`required_evidence_path` exists, and checks each `required_answer_atom` against
the compiled answer surface: `AGENTS.md` plus any explicit
`answer_surface_paths` / `compiled_evidence_paths` (or legacy `wiki/...`
entries in `required_evidence_paths`). Answer-surface paths must be compiled
surfaces (`AGENTS.md`, `CLAUDE.md`, or `wiki/...`). Raw `sources/...` evidence proves
provenance but **does not** satisfy answer atoms. The scorer appends the verdict
to `sources/eval/runs/<today>.jsonl` (its own telemetry), and exits:
**`0` = pass/advisory/ungated · `1` = fail (regression < 100%) · `2` =
error/unavailable.**

### Gate decision (default: enforce — fail-closed)

`MEMENTO_EVAL_GATE` selects behavior; default **`enforce`**:

- **`rc == 0`, `verdict: pass`** → proceed to Step 8 (commit).
- **`rc == 0`, `verdict: advisory`** (capability dipped, regression still 100%) → **warn, then commit.** Capability is a threshold suite, not load-bearing; a dip doesn't justify reverting.
- **`rc == 0`, `verdict: ungated`** (no scored regression fixtures) → **warn,
  then commit.** The Memento is usable but not protected by Gate-0; suggest
  drafting fixtures via `health-check fixtures`.
- **`rc >= 1`** — `verdict: fail` (a load-bearing fact was dropped) **or scorer error/unavailable** → **ROLL BACK and do NOT commit:**
  ```bash
  git -C "$MEMENTO_ROOT" checkout "$COMPILE_BASE_SHA" -- AGENTS.md wiki/
  ```
  This restores the hot set + wiki to the pre-compile state captured in Step 1, so a poisoned
  hot set never reaches the durable git record. **Fail-closed:** a scorer that cannot run is not
  a clean bill of health — roll back. On a `fail`, `eval-score --gate` has already written a
  defect follow-up (`sources/followups/compile-eval-fail-<today>.md`) naming the failing
  fixtures, closing the telemetry→source loop. **Report the rollback + the failing fixtures to
  the user; do not silently retry.**

`MEMENTO_EVAL_GATE=warn` downgrades a `fail` to warn-and-commit (verdict + follow-up still
recorded) — used only to land the gate or debug a fixture. The default is `enforce`.

### Self-test

`node ../_shared/scripts/eval-score --self-test` proves the scorer fails a
deliberately poisoned hot set and does not let raw source evidence satisfy a
compiled answer atom. Run it if you suspect the scorer itself is broken — a gate
you can't trust to fail is worse than no gate.

### Named rollback verb (operationalizes "git is the recovery layer")

To recover a bad hot set by hand, outside a compile:
- **`compile rollback hot-set`** → `git checkout <last eval-passing SHA> -- AGENTS.md` — restore the L1 hot set to its last green state (the last `sources/eval/runs/` entry with `verdict: pass` records the SHA).
- **`compile rollback compile`** → revert the most recent compile commit's `AGENTS.md` + `wiki/` changes (`git revert <sha>`, or `git checkout <prev> -- AGENTS.md wiki/`).
Both are plain git plumbing over the local history — no new infrastructure.

## Step 8: Commit (final step — mandatory when in a git repo)

The compile run is not finished until its output is committed. The git log is the
durable record of what each compile pass did, so this step replaces the inline
`<!-- Compile run ... -->` log that earlier versions wrote into INDEX.md.

See `references/commit-flow.md` for the full flow: git-context detection,
staging, the commit subject/body shape, and failure handling. Headline rules:

- Skip silently when not in a git repo; report `commit: skipped (not a git repo)`.
- **Only commit if Step 7.5 passed, was advisory, or reported `ungated`** — on a gate fail the compile was rolled back, so there is nothing to commit.
- Stage `wiki/`, `AGENTS.md`, **and `sources/eval/runs/`** (the eval verdict telemetry for this run — the only `sources/` path compile stages).
- Skip cleanly if nothing is staged; report `commit: skipped (no changes)`.
- Subject: `compile: update wiki — <brief synthesis>` (≤ 72 chars).
- Body lists sources processed, pages updated, hot-set deltas, and any
  unprocessed sources.
- Never push, never `--amend`. Pre-commit hook failure means the commit did
  not happen — fix, re-stage, new commit.

## Post-compile

Report to user: pages created / updated / unchanged, new entities discovered,
hot set changes (promoted/demoted), superseded/archived sources skipped, any
sources that couldn't be processed, any `<provider>_id` drift between sources
and existing wiki frontmatter (manual value left in place), evidence references
rewritten/removed by Step 5.5, the **Step 5.6 build-graph status** (ok / failed →
rediscovery skipped) and the **rediscovery picks surfaced** (or "none"), the
**Step 7.5 eval-gate verdict** (regression/capability pass rates, whether it was
gated, logged to `sources/eval/runs/`), and the commit SHA (or the rollback /
`skipped` reason).

## Guidelines

- **Synthesis, not copy-paste.** Wiki pages distill information from sources, not reproduce them verbatim.
- **Factual and observable.** Only include information derivable from source data.
- **Accumulate over time.** Each compile adds to the wiki — older content stays unless explicitly superseded.
- **Sparse pages are fine.** An entity with limited source mentions still gets a page with whatever is available.
- **Date everything.** Activity entries should include dates for timeline context.
- **Keep pages scannable.** Use headers, bullets, and bold for key info.
- **Respect entity type definitions.** Use the configured sections and frontmatter — don't improvise different structures.
