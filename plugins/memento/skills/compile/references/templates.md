# Compile templates

Page, INDEX, and hot-set templates referenced by `SKILL.md`. Examples below
use synthetic placeholders.

## Wiki page template

Each wiki page uses the sections defined in its entity type. The frontmatter
includes the fields specified in the entity type definition.

**Do NOT add `last_compiled` or `compile_pass` to per-page frontmatter.**
Page-level freshness lives only in the `Last Updated` column of
`wiki/INDEX.md`; git history covers everything else.

```markdown
---
title: <Entity Name>
type: <entity type>
<additional frontmatter fields from entity type definition>
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

### Example: people entity

A `people` entity type with sections `[Overview, Current Focus, Recent
Activity, Key Contributions]` produces:

```markdown
---
title: Jane Doe
type: people
role: Backend Engineer
team: Platform
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

## INDEX.md template

```markdown
---
last_compiled: YYYY-MM-DD
last_compile_commit: <40-char sha of HEAD captured at compile-start; omit on non-git Mementos>
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

The `Pinned` column shows `*` for pinned pages. The `pinned` frontmatter list
is the machine-readable source of truth.

## Hot set format

```markdown
<!-- HOT SET START — maintained by /compile, do not edit manually -->

## Quick Reference

### <Entity Type>
| Name | Summary | Details |
|------|---------|---------|
| Entity Name | One-line context | wiki/<type>/entity-slug.md |

<!-- HOT SET END -->
```
