# Starter AGENTS.md template

Used by `memento-setup` Phase 1 to scaffold the canonical `AGENTS.md` at the
Memento root. Phase 2 customizes the Entity Types registry and (optionally)
nickname tables.

```markdown
# Memory Base

This Memento uses a multi-layer cache model. Each layer has different access patterns.
Compilation flows upward: L3 → L2 → L1.

## Cache Layers

### L1 — This file (AGENTS.md) — Always resident
Loaded every session automatically by agent harnesses that support `AGENTS.md`.
Claude Code uses a thin local `CLAUDE.md` entrypoint that points here. Contains
behavioral rules, quick lookup tables, and pointers to L2. The hot set tables
below are maintained by `/compile`.

### L2 — Wiki (`wiki/`) — Loaded on demand
Compiled knowledge organized by topic. Read wiki pages when L1 doesn't have enough
detail. Start with `wiki/INDEX.md` to see what's available.

### L3 — Sources (`sources/`) — Cold storage
Raw ingestion. Session captures, automated syncs, manual notes. Only access when
L2 doesn't resolve the question.

### Outputs (`outputs/`) — Outside the hierarchy
Products of the system, not cache layers. `outputs/surfaces/` are HTML dashboards
served over HTTP. `outputs/reports/` are generated briefings and analyses.

## Directory Structure

```
sources/                # L3 — raw inputs
├── sessions/           # /fin captures from conversations
├── syncs/              # Automated pulls (one subdir per provider)
│   └── <provider>/     # e.g., concept2/, github/ — timestamped files
├── notes/              # Manual markdown
├── tasks/              # User-committed actions; existence = open
│   └── done/           # Archived completed tasks
└── followups/          # Uncommitted captures — open questions,
                        # awareness items, loose ends
wiki/                   # L2 — compiled knowledge
├── INDEX.md            # Master index with freshness + pinned status
└── <entity-type>/      # Subdirs per entity type
outputs/                # Products
├── surfaces/           # HTML dashboards served over HTTP
└── reports/            # Generated briefings, analyses
private/                # Sensitive notes — never compiled
```

## Conventions

### Filenames
- Session captures: `YYYY-MM-DDTHHmmss-topic.md`
- Sync data: `YYYY-MM-DDTHH-mm-ss.md` (in provider subdir)
- Manual notes: `YYYY-MM-DD-topic.md` or `descriptive-name.md`
- Tasks: `topic-slug.md` (date in frontmatter, not filename)

### Sources (`sources/`)
All inputs that feed the wiki. Organized by origin:
- **`sessions/`** — Extracted from conversations via `/fin`
- **`syncs/<provider>/`** — Automated pulls from external services
- **`notes/`** — Manual markdown dropped in directly
- **`tasks/`** — User-committed actions. Existence = open, deletion = done.
- **`followups/`** — Uncommitted captures: open questions, awareness items,
  things others surfaced, loose ends. Default destination for non-task
  `/fin` captures. Walked periodically via `/review-followups` and either
  promoted to `tasks/`, dismissed, or kept. Briefings do not surface
  follow-ups as urgent.

All source docs require YAML frontmatter with at least `date`.

Optional source lifecycle frontmatter controls whether a source shapes current
synthesis:

```yaml
status: active|superseded|archived
supersedes:
  - sources/path-to-old-source.md
superseded_by: sources/path-to-new-source.md
archive_note: "Why this is historical only"
correction_note: "What changed and why"
```

Missing `status` means `active`. `superseded` and `archived` sources remain in
history but are excluded from current-state compile output.

### Private (`private/`)
- Sensitive or personal notes
- Never compiled into wiki — privacy boundary

### Wiki (`wiki/`)
- AI-compiled synthesis maintained by `/compile`
- Topic-organized, not date-organized
- `INDEX.md` tracks every page with freshness and pinned status

### Outputs (`outputs/`)
- **`surfaces/`** — HTML dashboards, may be served via HTTP
- **`reports/`** — Generated content, write-once

## Lookup Hierarchy

Follow the cache layers:

1. **L1 (this file)** — Check the hot set tables below first.
2. **L2 (`wiki/`)** — Cache miss. Read `wiki/INDEX.md`, then the relevant page.
3. **L3 (`sources/`)** — Deep miss. Trace back to raw data.
4. **Ask the user** — If no layer has what you need.

## Agent Rules

- **Local-only repo** — Commit freely. No remote pushes unless explicitly asked.
- **No unsolicited changes** — Don't reorganize, rename, or "improve" files without being asked.
- **Outputs are immutable** — Files in `outputs/` are write-once. Never overwrite.
- **Private is private** — Never read `private/` contents into wiki or outputs.
- **Additive edits** — When updating wiki pages, add new information. Never delete historical content unless explicitly asked.

<!-- HOT SET START — maintained by /compile, do not edit manually -->
<!-- HOT SET END -->
```

## Starter `CLAUDE.md`

```markdown
# Claude Entrypoint

Read `AGENTS.md` at session start. It is the canonical shared Memento context for
Claude Code and Codex.

Claude-specific local configuration may remain under `.claude/`.
```
