# Entity Types registry and wiki INDEX seed

Read by `memento-config` Phase 2 when writing interview answers into
`AGENTS.md` and by the Update branch when adding or modifying an entity type.
The `## Entity Types` registry is the machine-readable contract that `compile`,
`save`, `ama`, and `followups` all read.

## Registry shape

The types, fields, and sections below are an example. Substitute what the
interview actually produced — running this verbatim seeds the wrong structure
(e.g. people/projects into a customer-management Memento).

```markdown
## Entity Types

### people
- **wiki_path:** `wiki/people/`
- **filename:** `firstname-lastname.md`
- **frontmatter:** title, type, role, team, sources, related
- **sections:** Overview, Current Focus, Recent Activity, Key Contributions
- **private_notes:** yes — route to `private/firstname-lastname.md`

### projects
- **wiki_path:** `wiki/projects/`
- **filename:** `project-slug.md`
- **frontmatter:** title, type, status, sources, related
- **sections:** Overview, Current Status, Key Decisions, Open Questions, Timeline

### customers
- **wiki_path:** `wiki/customers/`
- **filename:** `customer-slug.md`
- **frontmatter:** title, type, status, sources, related
- **sections:** Overview, Integration Status, Recent Activity, Key Contacts

### topics
- **wiki_path:** `wiki/topics/`
- **filename:** `topic-slug.md`
- **frontmatter:** title, type, sources, related
- **sections:** Overview, Current State, History
```

## Key properties per entity type

- **wiki_path** — subdirectory under `wiki/` for this type's pages
- **filename** — naming pattern for wiki pages of this type
- **frontmatter** — YAML frontmatter fields for wiki pages (always includes title, type, sources, related; do not include `last_compiled`, because freshness belongs in `wiki/INDEX.md`)
- **sections** — markdown sections each wiki page of this type should have
- **private_notes** (optional) — if `yes`, this entity type has private observations that route to `private/` instead of wiki. Include the filename pattern.
- **historical_sections** (optional) — comma-separated section headings whose `[[wikilinks]]` are treated as historical and excluded from the connection graph's current-state in-degree (`_shared/scripts/build-graph`). Defaults to History, Corrections, Recent Activity, Activity Log, Changelog, Archive, Superseded when omitted; declare this only to add type-specific historical sections (e.g. `Postmortems`).

## wiki/INDEX.md seed

One section per configured entity type:

```markdown
---
title: Wiki Index
last_compiled: <today>
pages: 0
pinned: []
---

# Wiki Index

## <Entity Type>
| Page | Summary | Last Updated | Pinned |
|------|---------|-------------|--------|

<!-- Repeat for each entity type -->

---
_Run `/compile` to build wiki from sources._
```
