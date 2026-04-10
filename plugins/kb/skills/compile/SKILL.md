---
name: compile
description: Compile wiki pages from all sources — tasks, decisions, research. Reads sources/**/*.md and synthesizes into wiki/ organized by topic/entity. First run builds full wiki; subsequent runs do incremental updates. Use when the user says "compile", "update the wiki", "build wiki", "compile wiki", or wants to refresh the knowledge base.
user-invocable: true
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Agent]
---

# Wiki Compiler

Compile all sources into a topic-organized wiki. Each wiki page covers one entity (a person, project, topic, or whatever entity types are configured in CLAUDE.md). Pages accumulate knowledge over time — this is additive, not destructive.

## Arguments

Arguments are passed as: $ARGUMENTS

- No arguments → incremental update (compile changes since last run)
- `full` → full rebuild (recompile everything from scratch)
- `<topic>` → recompile a single wiki page (e.g., `compile auth-service`, `compile project-alpha`)

## Safety rules

- **NEVER read files in `private/`** — that directory is a privacy boundary.
- **NEVER write files outside `wiki/`** — sources are read-only inputs.
- **All paths relative to repo root** — `sources/`, not absolute paths.

## Step 0: Determine scope

Run `date '+%Y-%m-%d'` to get today's date.

Check if `wiki/INDEX.md` exists:
- If it **does not exist** → treat as a full build regardless of arguments.
- If it **does exist** → get its modification time and find source files changed since then.

For incremental updates, use file modification times to detect changes:
```bash
# Find source files modified after last compile
find sources/ -name '*.md' -newer wiki/INDEX.md -not -path 'sources/tasks/done/*'
```
If no source files are newer than INDEX.md, report "wiki is current — no changes since last compile" and stop.

## Performance rules

**Speed is a hard constraint.** Follow these rules:

1. **Batch all reads in parallel.** Never read files one at a time. Issue all Read calls for a step in a single message so they execute concurrently. If you need to read 17 source files, that's ONE message with 17 Read tool calls — not 17 sequential messages.
2. **Batch all writes in parallel.** Same rule. If you're updating 10 wiki pages, issue all 10 Edit/Write calls in one message.
3. **No unnecessary reads.** Don't read wiki pages for entities that aren't mentioned in the changed sources. Don't re-read CLAUDE.md if you already have the entity types in context.
4. **Target: under 3 minutes for incremental compiles.** If you're taking longer, you're doing too much sequentially.

## Step 1: Gather all sources

### For incremental updates

1. Run `find sources/ -name '*.md' -newer wiki/INDEX.md -not -path 'sources/tasks/done/*'` to get the list of changed source files.
2. **In a single message**, issue parallel Read calls for ALL changed source files AND `wiki/INDEX.md`. This is one batch — not sequential reads.
3. After reading all changed sources, identify which entities are mentioned.
4. **In a single message**, issue parallel Read calls for ALL affected wiki pages that need updating.

### For full builds

Use Glob to find all files in each source directory. Then read them in parallel batches (max ~20 Read calls per message to stay within tool limits).

### Entity detection

Read `CLAUDE.md` to get the configured entity types and wiki organization. Use these to:
- Identify which entities are mentioned in sources
- Determine which wiki subdirectory each entity belongs in
- Detect new entities not previously tracked (if a topic appears 3+ times across sources, it deserves a page)

## Step 2: Extract mentions and build entity graph

Scan all gathered source content and extract mentions of configured entity types. Build a mapping: `entity → [list of source files that mention it]`

Also detect **new entities** not yet tracked — if a topic or name appears 3+ times across sources, it likely deserves its own page.

## Step 3: Compile wiki pages

**For incremental updates:** Do NOT launch subagents — the overhead isn't worth it. After reading all sources and wiki pages (Steps 1-2), synthesize all updates in your context and write them all in one parallel batch of Edit/Write calls.

**For full builds only:** Launch subagents via the Agent tool to compile pages in parallel, grouped by entity type.

### Wiki page template

Each wiki page follows this structure (adapt section names to entity type):

```markdown
---
title: <Entity Name>
type: <entity type>
last_compiled: YYYY-MM-DD
sources:
  - <relative path to source file>
related:
  - "[[related-entity-slug]]"
---

# <Entity Name>

## Overview
<2-3 sentence synthesis of what this entity is>

## Current State
<What's currently true — active work, recent decisions, open questions>

## Recent Activity
<Chronological highlights from source data, most recent first>

## History
<Key events, decisions, changes — accumulated over time>
```

### Writing pages

For each entity to compile:

1. **Existing page** — Read current content, merge new information. Update Current State and Recent Activity. Never delete History or prior content. Update `last_compiled` and `sources` frontmatter.

2. **New page** — Generate from template. Fill in from source material. Sparse pages are fine — they'll fill in over subsequent compiles.

3. Write pages in parallel where possible.

## Step 4: Cross-link pages

After all pages are written, ensure cross-links are consistent:

- Every `[[page-name]]` reference should correspond to an actual wiki page.
- Add cross-links in prose where entities are mentioned.
- Update `related` frontmatter arrays to reflect actual cross-references.

## Step 5: Build INDEX.md

Write `wiki/INDEX.md` with a catalog of every wiki page, grouped by entity type:

```markdown
---
last_compiled: YYYY-MM-DD
pages: <count>
---

# Wiki Index

## <Entity Type>
| Page | Last Updated |
|------|-------------|
| [[entity-slug]] | YYYY-MM-DD |

...
```

## Incremental update behavior

When running incrementally (not a full build):

1. Find changed source files. If none, stop — wiki is current.
2. **Read ALL changed source files in one parallel batch.**
3. Extract entity mentions. Build the list of affected wiki pages.
4. **Read ALL affected wiki pages in one parallel batch.**
5. Synthesize updates. **Write ALL updated wiki pages in one parallel batch.** Include INDEX.md in this batch.
6. Do NOT delete or rewrite content from prior compiles — this is additive. Update Current State sections with latest data; preserve History and prior content.

The entire incremental compile should be **3-4 roundtrips**: find changed files → read sources → read wiki pages → write updates.

## Post-compile

Commit all wiki changes:
```bash
git add wiki/
git commit -m "compile: update wiki from sources"
```

Report to user: pages created / updated / unchanged, new entities discovered, any sources that couldn't be processed.

## Guidelines

- **Synthesis, not copy-paste.** Wiki pages distill information from sources, not reproduce them verbatim.
- **Factual and observable.** Only include information derivable from source data.
- **Accumulate over time.** Each compile adds to the wiki — older content stays unless explicitly superseded.
- **Sparse pages are fine.** An entity with limited source mentions still gets a page with whatever is available.
- **Date everything.** Activity entries should include dates for timeline context.
- **Keep pages scannable.** Use headers, bullets, and bold for key info.
