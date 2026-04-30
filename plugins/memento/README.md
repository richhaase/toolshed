# memento — Personal Memory Base Plugin

A multi-layer cache memory base with automated compilation from sources to
wiki to canonical `AGENTS.md` context.

The plugin can be installed globally. Its skills resolve the Memento data root before
reading or writing, so the wiki can live in one configured directory while the
skills are invoked from any project.

## Cache model

The Memento treats knowledge like a CPU cache hierarchy:

- **L1 — `AGENTS.md`** (always resident where supported): Hot set tables with
  pointers to wiki pages. `CLAUDE.md` is a thin harness entrypoint that
  points to the same canonical context. Maintained automatically by
  `/compile`.
- **L2 — Wiki** (loaded on demand): Compiled topic pages. Read when L1 doesn't have enough detail.
- **L3 — Sources** (cold storage): Raw ingestion — session captures, automated syncs, manual notes. Accessed when L2 doesn't resolve the question.
- **Outputs** (outside hierarchy): Products of the system — surfaces (HTML dashboards) and reports.

Compilation flows upward: L3 -> L2 -> L1. The `/compile` skill handles the full pipeline.

## Quick start

```
/memento-setup
```

This scaffolds the directory structure and walks you through customizing the Memento for your use case.

## Memento root configuration

Skills resolve the Memento root in this order:

1. `MEMENTO_ROOT` environment variable
2. nearest `.memento-root` file walking upward from the current directory
3. `KB_ROOT` environment variable (deprecated compatibility alias)
4. nearest `.kb-root` file walking upward from the current directory (deprecated)
5. current directory, if it already looks like a Memento

For a global Memento, either export `MEMENTO_ROOT`:

```bash
export MEMENTO_ROOT=/Users/rdh/src/memento
```

Or add a `.memento-root` file to a project:

```text
/Users/rdh/src/memento
```

Bundled scripts:

- `skills/_shared/scripts/memento-root` prints the resolved Memento root.
- `skills/_shared/scripts/memento-run <command>` runs a command from the resolved Memento root.

## Directory structure

```
sources/                # L3 — raw inputs
├── sessions/           # /fin captures from conversations
├── syncs/              # Automated pulls (one subdir per provider)
│   └── <provider>/     # e.g., concept2/, github/
├── notes/              # Manual markdown
├── tasks/              # One file per task — user-committed actions
│   └── done/           # Archived completed tasks
└── followups/          # One file per follow-up — uncommitted captures
                        # (open questions, awareness items, loose ends)
wiki/                   # L2 — compiled knowledge
├── INDEX.md            # Master index with freshness + pinned status
└── <entity-type>/      # Subdirs per entity type
outputs/                # Products
├── surfaces/           # HTML dashboards, served over HTTP
└── reports/            # Generated briefings, analyses
private/                # Sensitive notes — never compiled
```

## Tasks vs follow-ups

A **task** is a user-committed action — "I will do X." Existence of the
file means an open commitment, and tasks get urgency-graded surfacing in
briefings.

A **follow-up** is anything else worth not losing — open questions, things
others surfaced, judgment calls awaiting clarification, loose ends from
build sessions. Follow-ups do not represent commitments and are not
surfaced as urgent. They live in `sources/followups/` and are walked
periodically via `/review-followups` (oldest-first by default).

`/fin` captures non-task items as follow-ups by default. Promotion
(follow-up → task) happens via `/tasks` when the user decides to drive
something. This split exists because conflating the two produced "urgent
task" framings on what were actually informational items.

## Skills

| Skill | Description |
|-------|-------------|
| `memento-setup` | Scaffold a Memento repo and customize it via interview |
| `compile` | Full pipeline: L3 -> L2 (sources -> wiki) then L2 -> L1 (wiki -> `AGENTS.md` hot set) |
| `fin` | End-of-session capture — extract decisions, tasks, follow-ups, and findings |
| `tasks` | Task CRUD — create, list, update, complete, promote-from-follow-up |
| `review-followups` | Walk open follow-ups one at a time and decide: promote, dismiss, keep, or answer |
| `research` | Research with staleness tracking and source attribution |
| `health-check` | Read-only audit for source status, staleness, gaps, contradictions, L1 freshness |

For lookup, follow the L1 -> L2 -> L3 hierarchy directly (start at `AGENTS.md`,
descend into `wiki/` and `sources/` as needed). For capture, edit files under
`sources/` directly or use `fin` for session-end captures. Supersession is a
manual frontmatter edit (see Source status below).

## Source status

Sources are current by default. Add frontmatter when a source should stop
shaping current synthesis:

```yaml
---
status: active|superseded|archived
supersedes:
  - sources/path-to-old-source.md
superseded_by: sources/path-to-new-source.md
archive_note: "Why this is historical only"
correction_note: "What changed and why"
---
```

`compile` ignores `superseded` and `archived` sources for current-state wiki and
hot-set synthesis. `health-check` validates status consistency, broken
supersession links, stale index entries, and private leakage.

## Design principles

- **Multi-layer cache.** L1 (`AGENTS.md`) -> L2 (wiki) -> L3 (sources). Progressive disclosure.
- **Convention over configuration.** File existence = open task. Frontmatter = metadata. Directories = organization.
- **Local-first.** Git repo, no remote required.
- **Additive.** Wiki compilation never destroys historical content.
- **Private by default.** `private/` is never compiled or referenced externally.
- **Opinionated defaults, customizable.** Works immediately; `memento-setup` interview tunes it.

## File conventions

- All content is Markdown with YAML frontmatter
- Filenames: lowercase, hyphens, no spaces
- Session captures: `YYYY-MM-DDTHHmmss-topic.md`
- Sync data: `YYYY-MM-DDTHH-mm-ss.md` (in provider subdir)
- Tasks: `topic-slug.md` (date in frontmatter, not filename)
- Required frontmatter: `title`, `date`

## License

MIT
