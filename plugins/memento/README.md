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
/memento-config
```

On a fresh directory, this scaffolds the structure and walks you through
customizing entity types, profile, and nicknames. On an existing Memento,
it detects current state and offers a targeted update branch (add an entity
type, modify an entity type, update profile, update nicknames).

## Memento root configuration

Skills resolve the Memento root in this order:

1. `MEMENTO_ROOT` environment variable
2. nearest `.memento-root` file walking upward from the current directory
3. current directory, if it already looks like a Memento

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
surfaced as urgent. They live in `sources/followups/` and are reviewed
periodically via `/followups` — which lists open items by default,
shows one item read-only with `/followups <slug>`, and walks the queue
interactively with `/followups walk`.

`/fin` captures non-task items as follow-ups by default. Promotion
(follow-up → task) happens via `/followups` when the user decides to drive
something. This split exists because conflating the two produced "urgent
task" framings on what were actually informational items.

## Health and eval discipline

L1 and L2 are generated projections over L3 sources, not authority. Use
`health-check` before adding retrieval machinery: it audits cache freshness,
broken evidence paths, compile metadata drift, public-surface privacy risks,
open queue visibility, and eval readiness without reading `private/` or writing
repairs.

If lookup quality needs measurement, start with local golden-query fixtures:
expected evidence paths, forbidden paths, freshness dates, and abstention cases.
Public memory benchmarks can inform the taxonomy, but local questions decide
whether this Memento is working.

## Skills

| Skill | Description |
|-------|-------------|
| `memento-config` | Idempotent setup-and-update surface — scaffolds new Mementos, offers a targeted update branch on existing ones |
| `compile` | Full pipeline: L3 -> L2 (sources -> wiki) then L2 -> L1 (wiki -> `AGENTS.md` hot set) |
| `health-check` | Read-only doctor for stale projections, broken evidence paths, privacy lint, compile metadata drift, and golden-query eval readiness |
| `fin` | Passive end-of-session capture — extract decisions, tasks, follow-ups, research, analyses, private notes |
| `ama` | Active LLM-driven interview — read the wiki, ask the user to fill gaps, capture answers as a session source |
| `followups` | Review open tasks and follow-ups: `list` (default) prints the inventory, `show <slug>` renders one item read-only, `walk` triages one at a time (keep, dismiss, done, promote, demote, note) |

For lookup, follow the L1 -> L2 -> L3 hierarchy directly (start at `AGENTS.md`,
descend into `wiki/` and `sources/` as needed). For passive capture, edit
files under `sources/` directly or use `/fin` at session end. For active
capture, run `/ama` to let the agent interview you on what's missing.
Supersession is a manual frontmatter edit (see Source status below).

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

`compile` ignores `superseded` and `archived` sources for current-state wiki
and hot-set synthesis.

## Design principles

- **Multi-layer cache.** L1 (`AGENTS.md`) -> L2 (wiki) -> L3 (sources). Progressive disclosure.
- **Convention over configuration.** File existence = open task. Frontmatter = metadata. Directories = organization.
- **Local-first.** Git repo, no remote required.
- **Additive.** Wiki compilation never destroys historical content.
- **Private by default.** `private/` is never compiled or referenced externally.
- **Opinionated defaults, customizable.** Works immediately; `memento-config` interview tunes it on first run, and updates it on subsequent runs.

## File conventions

- All content is Markdown with YAML frontmatter
- Filenames: lowercase, hyphens, no spaces
- Session captures: `YYYY-MM-DDTHHmmss-topic.md`
- Sync data: `YYYY-MM-DDTHH-mm-ss.md` (in provider subdir)
- Tasks: `topic-slug.md` (date in frontmatter, not filename)
- Required frontmatter: `title`, `date`

## License

MIT
