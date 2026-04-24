# kb — Personal Knowledge Base Plugin

A multi-layer cache knowledge base with automated compilation from sources to
wiki to canonical `AGENTS.md` context.

## Cache model

The KB treats knowledge like a CPU cache hierarchy:

- **L1 — `AGENTS.md`** (always resident where supported): Hot set tables with
  pointers to wiki pages. `CLAUDE.md` and `GEMINI.md` are thin harness
  entrypoints that point to the same canonical context. Maintained
  automatically by `/compile`.
- **L2 — Wiki** (loaded on demand): Compiled topic pages. Read when L1 doesn't have enough detail.
- **L3 — Sources** (cold storage): Raw ingestion — session captures, automated syncs, manual notes. Accessed when L2 doesn't resolve the question.
- **Outputs** (outside hierarchy): Products of the system — surfaces (HTML dashboards) and reports.

Compilation flows upward: L3 -> L2 -> L1. The `/compile` skill handles the full pipeline.

## Quick start

```
/kb-setup
```

This scaffolds the directory structure and walks you through customizing the KB for your use case.

## Directory structure

```
sources/                # L3 — raw inputs
├── sessions/           # /fin captures from conversations
├── syncs/              # Automated pulls (one subdir per provider)
│   └── <provider>/     # e.g., concept2/, github/
├── notes/              # Manual markdown
└── tasks/              # One file per task (existence = open)
    └── done/           # Archived completed tasks
wiki/                   # L2 — compiled knowledge
├── INDEX.md            # Master index with freshness + pinned status
└── <entity-type>/      # Subdirs per entity type
outputs/                # Products
├── surfaces/           # HTML dashboards, served over HTTP
└── reports/            # Generated briefings, analyses
private/                # Sensitive notes — never compiled
```

## Skills

| Skill | Description |
|-------|-------------|
| `kb-setup` | Scaffold a KB repo and customize it via interview |
| `compile` | Full pipeline: L3 -> L2 (sources -> wiki) then L2 -> L1 (wiki -> `AGENTS.md` hot set) |
| `fin` | End-of-session capture — extract decisions, tasks, findings to `sources/sessions/` |
| `tasks` | Task CRUD — create, list, update, mark done |
| `research` | Research with recall, staleness tracking, source attribution |
| `health-check` | Read-only audit for staleness, gaps, contradictions, L1 freshness |

## Design principles

- **Multi-layer cache.** L1 (`AGENTS.md`) -> L2 (wiki) -> L3 (sources). Progressive disclosure.
- **Convention over configuration.** File existence = open task. Frontmatter = metadata. Directories = organization.
- **Local-first.** Git repo, no remote required.
- **Additive.** Wiki compilation never destroys historical content.
- **Private by default.** `private/` is never compiled or referenced externally.
- **Opinionated defaults, customizable.** Works immediately; `kb-setup` interview tunes it.

## File conventions

- All content is Markdown with YAML frontmatter
- Filenames: lowercase, hyphens, no spaces
- Session captures: `YYYY-MM-DDTHHmmss-topic.md`
- Sync data: `YYYY-MM-DDTHH-mm-ss.md` (in provider subdir)
- Tasks: `topic-slug.md` (date in frontmatter, not filename)
- Required frontmatter: `title`, `date`

## License

MIT
