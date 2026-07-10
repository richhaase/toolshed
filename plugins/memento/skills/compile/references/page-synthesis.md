# Page synthesis

Read this reference before Step 4. It defines incremental work classes,
parallelism, full-build workers, and merge/write mechanics.

## Contents

- [Incremental updates](#incremental-updates)
- [Full builds](#full-builds)
- [Page merge and write rules](#page-merge-and-write-rules)

## Incremental updates

Once Step 3 fixes the affected-page set, partition it by work type.

### Class A: activity-log appends

Use Class A when the only change is dated lines at the top of `Recent Activity`
or `Activity Log` (PR-author activity, meeting attendance, incidental mentions).
Each page gets one targeted `Edit`; issue all Class-A edits as one parallel
batch. A named PR author or attendee is incidental activity, not substantive
new state.

Never regenerate a whole accumulated page for a routine activity append. The
only time an activity section warrants a full `Write` is periodic compaction:
keep 30 days inline, summarize older entries by week, and entries older than 90
days by month. Sources remain the full historical record.

### Class B: substantive synthesis

New pages, pages changing more than two non-activity sections, complex state
merges, and person-enrichment merges are Class B. With three or more independent
Class-B pages, fan out one subagent per page (or same-type batch) in one
concurrent dispatch. With at most two, synthesize inline.

Each subagent receives only the entity name, entity-type definition, relevant
source excerpts, and current page. It writes only its assigned page and returns
a one-line summary of sections touched and any `<provider>_id` drift. It must
not read `private/`, write another page, or run cross-linking, INDEX/hot-set
generation, the eval gate, or the commit. The orchestrator owns those steps.

Use this brief:

```text
Compile a single wiki page for entity "<name>" (type "<type>").

Entity type definition:
- wiki_path: <path>
- filename: <filename>
- frontmatter fields: <fields>
- sections: <sections>

Current page content (merge into; preserve accumulated sections):
<current page body, or "NEW PAGE">

Source material for this entity:
<relevant source excerpts>

Write only <wiki_path>/<filename> using the page merge/write rules. Do not read
private/ or touch any other page, INDEX.md, or AGENTS.md. Return one line:
sections touched + any <provider>_id drift.
```

The normal affected-page count for about 13 changed sources is below 25. Above
that, re-check Step 3 and prune entities with only passing references.

## Full builds

When the harness exposes background agents, launch one worker per entity type.
In Claude Code use `Agent`; in Codex use its available multi-agent/background
primitive. Without one, process entity types in the main session with bounded
parallel read/write batches.

Each worker receives only the bounded evidence excerpts relevant to its assigned
type/entity batch plus the complete entity-type definition. Split a large type
into multiple disjoint entity batches; no worker or orchestrator should retain
the whole source corpus. Compile those batches in parallel. Use:

```text
Compile wiki pages for entity type "<type>".

Entity type definition:
- wiki_path: <path>
- filename pattern: <pattern>
- frontmatter fields: <fields>
- sections: <sections>

Entities to compile: <entity names and source files>

Write each page to <wiki_path>/<filename> using references/templates.md and the
page merge/write rules. Do not read private/. Use only the provided source data.
```

## Page merge and write rules

The template and worked example are in `templates.md`. Frontmatter comes from
the entity type; never add `last_compiled` or `compile_pass` to pages. Page
freshness belongs only in INDEX.md.

For each entity:

1. **Existing page:** merge current content and update dynamic sections. Keep
   accumulated History, Key Contributions, and Key Decisions unless their
   prior source is superseded or archived; move those claims into historical or
   correction prose instead of current state. Refresh `sources` with the active
   sources used for current synthesis.
2. **New page:** generate from the template. Sparse pages are valid.
3. **Person enrichment:** for each person page, look up the full name in all
   gathered `<provider>_users` maps. Emit `<provider>_id` only when the Entity
   Types registry declares that field and the existing field is absent or equal.
   Never overwrite a differing manual value; preserve it and report drift.
4. Write independent pages in parallel where possible.

Use targeted `Edit` for one or two substantive sections, frontmatter tweaks,
and every routine activity append. Prefer one `Write` when more than two
substantive sections change; it costs less than chained searches and repeated
context. Every page, whether inline or delegated, follows these same rules.
