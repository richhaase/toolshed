---
name: compile
description: >
  Compile source documents into wiki pages. Reads sources/*.md, extracts entity mentions,
  and generates or updates wiki pages with structured synthesis. Use when the user says
  "compile", "build wiki", "update wiki", "sync wiki", "compile sources", "regenerate
  pages", "refresh the wiki", or wants their source material synthesized into organized
  wiki pages. Incremental by default — only recompiles pages affected by changed sources.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Agent
---

# Compile

Read `sources/**/*.md`, extract entity mentions, build entity graph, and write
`wiki/<category>/<entity-slug>.md` pages with structured synthesis. Maintain
`wiki/INDEX.md` as a catalog of all pages.

## Pre-flight

1. Verify KB structure exists (check for `sources/` and `wiki/` directories).
2. Read `CLAUDE.md` for KB profile — entity types, wiki organization, conventions.
3. Check for existing wiki pages to determine incremental vs full compile.

## Source scanning

### Find all sources

```bash
find sources/ -name '*.md' -not -path 'sources/tasks/done/*' | sort
```

Exclude `private/` — never read private content for compilation.

### Read sources in parallel

Batch source reads using the Agent tool or parallel Read calls. For each source file:
- Read the full content
- Extract YAML frontmatter (date, title, tags, type)
- Identify entity mentions (names, project references, topic keywords)
- Note relationships between entities

### Build entity graph

From all sources, build a map of:
- Entity → source files that mention it
- Entity → related entities (co-mentioned)
- Entity → most recent mention date

## Incremental compilation

By default, only recompile pages affected by changes since last compile.

### Detect changes

Check git for modified source files since the last compile commit:

```bash
git log --oneline --all --grep="compile" -1 --format="%H"
git diff --name-only <last-compile-hash> -- sources/
```

If no compile commit exists, or the user requests a full compile, process all sources.

### Determine affected pages

An entity page needs recompilation if:
- Any source mentioning that entity was modified
- A new source mentions the entity
- A related entity's page was recompiled (transitive, one level only)

## Page generation

### Wiki page template

Each wiki page follows this structure:

```markdown
---
title: <Entity Name>
type: <entity type from KB profile>
last_compiled: <ISO 8601 timestamp>
sources:
  - <relative path to source file>
related:
  - <slug of related entity>
---

# <Entity Name>

## Overview
<2-3 sentence synthesis of what this entity is>

## Current state
<What's currently true — active projects, recent decisions, open questions>

## Recent activity
<Bullet list of recent mentions from sources, most recent first>

## History
<Chronological record of significant events, decisions, changes>
```

### Writing pages

For each entity to compile:

1. **Existing page** — Read current content, merge new information. Add to Recent
   activity and update Current state. Never delete historical content. Update the
   `last_compiled` and `sources` frontmatter.

2. **New page** — Generate from template. Fill in from source material. If insufficient
   source material for a full page, write what's available and note gaps.

3. Write pages in parallel where possible.

### Update INDEX.md

After all pages are written, regenerate `wiki/INDEX.md`:

```markdown
---
title: Wiki Index
date: <today>
last_compiled: <ISO 8601 timestamp>
---

# Wiki Index

## Categories

### <Category 1>
- [Entity Name](category/entity-slug.md) — <one-line description>

## Statistics
- Total pages: <count>
- Last compiled: <timestamp>
- Sources processed: <count>

## Recent updates
- <date>: Updated <entity> — <what changed>
```

## Post-compile

1. Commit all wiki changes:
   ```bash
   git add wiki/
   git commit -m "compile: update wiki from sources"
   ```

2. Report to user:
   - Pages created / updated / unchanged
   - New entities discovered
   - Any sources that couldn't be processed (missing frontmatter, etc.)

## Performance

- Batch file reads in parallel — use Agent tool for parallel reads when >10 files.
- Write pages in parallel where possible.
- For large KBs (>50 source files), process in batches of 20.
- Skip unchanged sources early — check mtime or git status before reading.
