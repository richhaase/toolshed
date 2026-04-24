---
name: compile
description: Compile wiki pages from all sources — tasks, decisions, research. Reads sources/**/*.md and synthesizes into wiki/ organized by topic/entity, then refreshes the AGENTS.md hot set. First run builds full wiki; subsequent runs do incremental updates. Use when the user says "compile", "update the wiki", "build wiki", "compile wiki", or wants to refresh the knowledge base.
user-invocable: true
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Agent]
---

# Wiki Compiler

Compile all sources into a topic-organized wiki. Each wiki page covers one entity,
organized by entity type as defined in the canonical `AGENTS.md` Entity Types
registry. In legacy KB repos without `AGENTS.md`, fall back to an existing
`CLAUDE.md` or `GEMINI.md` registry and report that the repo should be migrated.
Pages accumulate knowledge over time — this is additive, not destructive.

## Arguments

Arguments are passed as: $ARGUMENTS

- No arguments → incremental update (compile changes since last run)
- `full` → full rebuild (recompile everything from scratch)
- `<topic>` → recompile a single wiki page (e.g., `compile auth-service`, `compile jane-doe`)

## Safety rules

- **NEVER read files in `private/`** — that directory is a privacy boundary.
- **NEVER write files outside `wiki/` and `AGENTS.md`** — sources are read-only inputs. The only exception is a legacy repo without `AGENTS.md`, where you may update the existing entrypoint that owns the hot set and report the migration need.
- **All paths relative to repo root** — `sources/`, not absolute paths.

## Step 0: Read Entity Types registry

Read `AGENTS.md` and parse the `## Entity Types` section. This tells you:
- What entity types exist (people, projects, customers, topics, etc.)
- Where each type's wiki pages live (`wiki_path`)
- What filename pattern to use (`filename`)
- What frontmatter fields each type needs (`frontmatter`)
- What sections each type's wiki pages should have (`sections`)

If `AGENTS.md` is missing or lacks an Entity Types registry, check legacy
entrypoints in this order: `CLAUDE.md`, then `GEMINI.md`. If neither has a
registry, fall back to a flat `wiki/` with the generic template (Overview,
Current State, Recent Activity, History).

## Step 1: Determine scope

Run `date '+%Y-%m-%d'` to get today's date.

Check if `wiki/INDEX.md` exists:
- If it **does not exist** → treat as a full build regardless of arguments.
- If it **does exist** → get its modification time and find source files changed since then.

For incremental updates, use file modification times to detect changes:
```bash
# Find source files modified after last compile (sessions, syncs, notes, tasks)
find sources/sessions/ sources/syncs/ sources/notes/ sources/tasks/ -name '*.md' -newer wiki/INDEX.md -not -path 'sources/tasks/done/*' 2>/dev/null
```
If no source files are newer than INDEX.md, report "wiki is current — no changes since last compile" and stop.

## Performance rules

**Speed is a hard constraint.** Follow these rules:

1. **Batch all reads in parallel.** Never read files one at a time. Issue all Read calls for a step in a single message so they execute concurrently. If you need to read 17 source files, that's ONE message with 17 Read tool calls — not 17 sequential messages.
2. **Batch all writes in parallel.** Same rule. If you're updating 10 wiki pages, issue all 10 Edit/Write calls in one message.
3. **No unnecessary reads.** Don't read wiki pages for entities that aren't mentioned in the changed sources. Don't re-read `AGENTS.md` if you already have the entity types in context.
4. **Target: under 3 minutes for incremental compiles.** If you're taking longer, you're doing too much sequentially.

## Step 2: Gather all sources

### For incremental updates

1. Run `find sources/sessions/ sources/syncs/ sources/notes/ sources/tasks/ -name '*.md' -newer wiki/INDEX.md -not -path 'sources/tasks/done/*' 2>/dev/null` to get the list of changed source files.
2. **In a single message**, issue parallel Read calls for ALL changed source files AND `wiki/INDEX.md`. This is one batch — not sequential reads.
3. After reading all changed sources, identify which entities are mentioned and which entity type each belongs to.
4. **In a single message**, issue parallel Read calls for ALL affected wiki pages that need updating.

### For full builds

Use Glob to find all files in each source directory. Then read them in parallel batches (max ~20 Read calls per message to stay within tool limits).

## Step 3: Extract mentions and build entity graph

Scan all gathered source content and extract mentions of entities, classified by type
from the Entity Types registry. Build a mapping:

`entity type → entity name → [list of source files that mention it]`

Also detect **new entities** not yet tracked — if a topic or name appears 3+ times
across sources, it likely deserves its own page. Assign it to the most appropriate
entity type.

## Step 4: Compile wiki pages

### For incremental updates

Do NOT launch subagents — the overhead isn't worth it for updating a subset of pages.
After reading all sources and wiki pages (Steps 2-3), synthesize all updates in your
context and write them all in one parallel batch of Edit/Write calls.

### For full builds

Launch one subagent per entity type via the Agent tool. Each agent:
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

Each wiki page uses the sections defined in its entity type. The frontmatter includes
the fields specified in the entity type definition.

```markdown
---
title: <Entity Name>
type: <entity type>
<additional frontmatter fields from entity type definition>
last_compiled: YYYY-MM-DD
sources:
  - <relative path to source file>
related:
  - "[[related-entity-slug]]"
---

# <Entity Name>

## <Section 1 from entity type definition>
<content>

## <Section 2 from entity type definition>
<content>

...
```

For example, a `people` entity type with sections `[Overview, Current Focus, Recent Activity, Key Contributions]` produces:

```markdown
---
title: Jane Doe
type: people
role: Backend Engineer
team: Platform
last_compiled: 2026-04-10
sources:
  - sources/2026-04-08-api-migration.md
related:
  - "[[api-migration]]"
---

# Jane Doe

**Role:** Backend Engineer · **Team:** Platform

## Overview
...

## Current Focus
...

## Recent Activity
...

## Key Contributions
...
```

### Writing pages

For each entity to compile:

1. **Existing page** — Read current content, merge new information. Update dynamic sections (Current Focus, Current State, Recent Activity). Never delete accumulated sections (History, Key Contributions, Key Decisions). Update `last_compiled` and `sources` frontmatter.

2. **New page** — Generate from template. Fill in from source material. Sparse pages are fine — they'll fill in over subsequent compiles.

3. Write pages in parallel where possible.

## Step 5: Cross-link pages

After all pages are written, ensure cross-links are consistent:

- Every `[[page-name]]` reference should correspond to an actual wiki page.
- Add cross-links in prose where entities are mentioned (e.g., "Working with [[jane-doe]] on [[api-migration]]").
- Update `related` frontmatter arrays to reflect actual cross-references.

## Step 6: Build INDEX.md

Write `wiki/INDEX.md` with a catalog of every wiki page, grouped by entity type.
The INDEX tracks pinned status — pages marked as pinned always appear in the
`AGENTS.md` hot set regardless of recency.

Preserve the existing `pinned` list from the INDEX.md frontmatter — don't drop
manual pins. Add any new pages to the table but don't auto-pin them.

```markdown
---
last_compiled: YYYY-MM-DD
pages: <count>
pinned:
  - <slug>
---

# Wiki Index

## <Entity Type 1>
| Page | Summary | Last Updated | Pinned |
|------|---------|-------------|--------|
| [[entity-slug]] | One-line summary | YYYY-MM-DD | * |

## <Entity Type 2>
...
```

The `Pinned` column shows `*` for pinned pages. The `pinned` frontmatter list is
the machine-readable source of truth.

The columns per entity type come from the key frontmatter fields defined in the
Entity Types registry, plus Summary, Last Updated, and Pinned.

## Incremental update behavior

When running incrementally (not a full build):

1. Find changed source files. If none, stop — wiki is current.
2. **Read ALL changed source files in one parallel batch.**
3. Extract entity mentions by type. Build the list of affected wiki pages.
4. **Read ALL affected wiki pages in one parallel batch.**
5. Synthesize updates. **Write ALL updated wiki pages + INDEX.md in one parallel batch.**
6. **Read `AGENTS.md`, rebuild the hot set between markers, write `AGENTS.md`.**
7. Do NOT delete or rewrite content from prior compiles — this is additive. Update dynamic sections with latest data; preserve accumulated sections.

The entire incremental compile should be **4-5 roundtrips**: find changed files → read sources → read wiki pages → write wiki updates → write L1 hot set.

## Step 7: Distill L2 -> L1 (`AGENTS.md` hot set)

After the wiki is updated, rebuild the dynamic hot set section in canonical
`AGENTS.md`. `CLAUDE.md` and `GEMINI.md` should be thin harness entrypoints that
point to `AGENTS.md`; do not duplicate the hot set into them.

### How it works

1. Read `wiki/INDEX.md` — get the full page list with `last_compiled` dates and
   `pinned` list from frontmatter.
2. Read `AGENTS.md` and find the markers `<!-- HOT SET START -->` and `<!-- HOT SET END -->`.
3. Build the hot set:
   - **All pinned pages** go in, regardless of recency.
   - **Most recently updated pages** fill remaining slots, sorted by `last_compiled` descending.
   - **Cap per entity type**: max 5 entries per type (configurable, start simple).
   - **Total cap**: ~20 entries across all types. The hot set must stay small.
4. For each entry, write one row: name, one-line summary, link to wiki page.
5. Replace everything between the HOT SET markers in `AGENTS.md` with the new tables.

For a legacy repo that does not have `AGENTS.md`, update the first existing
entrypoint with hot set markers (`CLAUDE.md`, then `GEMINI.md`) and report that
the repo should migrate to canonical `AGENTS.md` plus thin harness entrypoints.

### Hot set format

```markdown
<!-- HOT SET START — maintained by /compile, do not edit manually -->

## Quick Reference

### <Entity Type>
| Name | Summary | Details |
|------|---------|---------|
| Entity Name | One-line context | wiki/<type>/entity-slug.md |

<!-- HOT SET END -->
```

### Safety

- **Only modify content between the markers.** Never touch anything outside them.
- If the markers don't exist in `AGENTS.md`, append them at the end of the file and
  then write the hot set.
- Do not append hot set markers to thin `CLAUDE.md` or `GEMINI.md` files when
  `AGENTS.md` exists.
- The hot set is fully regenerated each compile — it's not an incremental edit.

## Post-compile

Commit all changes (wiki + `AGENTS.md` hot set update):
```bash
git add wiki/ AGENTS.md
git commit -m "compile: update wiki from sources"
```

Report to user: pages created / updated / unchanged, new entities discovered, hot set changes (promoted/demoted), any sources that couldn't be processed.

## Guidelines

- **Synthesis, not copy-paste.** Wiki pages distill information from sources, not reproduce them verbatim.
- **Factual and observable.** Only include information derivable from source data.
- **Accumulate over time.** Each compile adds to the wiki — older content stays unless explicitly superseded.
- **Sparse pages are fine.** An entity with limited source mentions still gets a page with whatever is available.
- **Date everything.** Activity entries should include dates for timeline context.
- **Keep pages scannable.** Use headers, bullets, and bold for key info.
- **Respect entity type definitions.** Use the configured sections and frontmatter — don't improvise different structures.
