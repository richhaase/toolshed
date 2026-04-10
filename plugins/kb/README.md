# kb — Personal Knowledge Base Plugin

A structured personal knowledge base with a `sources/` → `wiki/` compilation pipeline, task management, research docs, session finishing, and health checks.

## Quick start

```
/kb-setup
```

This scaffolds the directory structure and walks you through customizing the KB for your use case.

## Directory structure

```
sources/           # Raw inputs — notes, synced data, research docs
├── tasks/         # One file per task (existence = open)
│   └── done/      # Archived completed tasks
wiki/              # AI-compiled synthesis, topic-organized
outputs/           # Persisted reports, analyses (write-once)
private/           # Sensitive notes — never compiled into wiki
```

## Skills

| Skill | Description |
|-------|-------------|
| `kb-setup` | Scaffold a KB repo and customize it via interview |
| `compile` | Compile `sources/` into structured `wiki/` pages |
| `fin` | End-of-session capture — extract decisions, tasks, findings |
| `tasks` | Task CRUD — create, list, update, mark done |
| `research` | Research with recall, staleness tracking, source attribution |
| `health-check` | Read-only audit for staleness, gaps, contradictions |

## Design principles

- **Convention over configuration.** File existence = open task. Frontmatter = metadata. Directories = organization.
- **Local-first.** Git repo, no remote required.
- **Additive.** Wiki compilation never destroys historical content.
- **Private by default.** `private/` is never compiled or referenced externally.
- **Opinionated defaults, customizable.** Works immediately; `kb-setup` interview tunes it.

## File conventions

- All content is Markdown with YAML frontmatter
- Filenames: lowercase, hyphens, no spaces
- Tasks: `topic-slug.md` (date in frontmatter, not filename)
- Research: `YYYY-MM-DD-HHmm-topic-slug.md`
- Required frontmatter: `title`, `date`

## License

MIT
