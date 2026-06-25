# Starter AGENTS.md template

Used by `memento-config` Phase 1 to scaffold the canonical `AGENTS.md` at the
Memento root. Phase 2 customizes the Entity Types registry and (optionally)
nickname tables. The Update branch (existing-Memento mode) edits sections of
this template in place rather than re-writing it.

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
├── sessions/           # /save captures from conversations
├── syncs/              # Automated pulls (one subdir per provider)
│   └── <provider>/     # e.g., concept2/, github/ — timestamped files
├── notes/              # Durable knowledge — folds into wiki on /compile
├── followups/          # Small queue of "re-read within a week, act on it"
│                       # items with expires_at frontmatter
├── trajectories/       # YYYY-MM-DD/<run-id>.md — session telemetry from
│                       # /save and /ama. Local-only, NOT compiled.
└── eval/               # Golden-query fixtures + gate-run telemetry. NOT compiled.
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
- Notes: `YYYY-MM-DD-topic.md` or `descriptive-name.md`
- Follow-ups: `topic-slug.md` (date and `expires_at` in frontmatter)

### Sources (`sources/`)
All inputs that feed the wiki. Organized by origin:
- **`sessions/`** — Extracted from conversations via `/save`
- **`syncs/<provider>/`** — Automated pulls from external services
- **`notes/`** — Durable knowledge. `/compile` folds these into `wiki/`.
- **`followups/`** — Small queue of "re-read within a week, act on it"
  captures. Each item carries `expires_at` (default: date + 14 days)
  and a one-line `rationale`. Reviewed periodically via `/followups`
  (lists expired-first by default, or `/followups walk` to triage) and
  either dismissed, answered into a note, noted, or filed-and-dismissed
  when something turns out to be a real commitment that belongs in the
  issue tracker. The Memento does not store tasks itself.
- **`trajectories/`** — `YYYY-MM-DD/<run-id>.md` session telemetry emitted by
  `/save` and `/ama` (outcome, skills/tools used, lessons). Local-only, never
  compiled or promoted — the substrate the learning loop reads.
- **`eval/`** — golden-query fixtures and gate-run telemetry for the `/compile`
  eval gate. Not a synthesis input.

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

## Cache Integrity

L1 (`AGENTS.md`) and L2 (`wiki/`) are generated projections over L3 sources,
not authority. Treat them as convenient caches. When freshness, provenance, or
privacy classification is in doubt, inspect L3 sources and source policy before
trusting compiled summaries.

`/compile` protects L1 with a fail-closed golden-query eval gate: if a
load-bearing fact drops out of the hot set, it rolls back `AGENTS.md` + `wiki/`
rather than committing a regression.

Run `/health-check` when you need a read-only doctor pass for stale projections,
broken evidence paths, compile metadata drift, public-surface privacy risks, or
golden-query eval readiness. The health check must not read `private/`.

### Outputs (`outputs/`)
- **`surfaces/`** — HTML dashboards, may be served via HTTP
- **`reports/`** — Generated content, write-once

## Lookup Hierarchy

Follow the cache layers:

1. **L1 (this file)** — Check the hot set tables below first.
2. **L2 (`wiki/`)** — Cache miss. Read `wiki/INDEX.md`, then the relevant page.
   To find what links *to* a page (backlinks), `grep -rlF '[[<slug>]]' wiki/` — a
   coarse superset (matches history sections and superseded pages, undeduped; `-F`
   is required). The memento skills compute exact current-state backlinks on demand.
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
