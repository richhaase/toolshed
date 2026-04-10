---
name: kb-setup
description: >
  Set up and scaffold a personal knowledge base repository. Creates the directory structure
  (sources, wiki, outputs, private), generates a starter CLAUDE.md, then interviews the
  user to customize the KB for their use case. Use when the user says "set up a knowledge
  base", "create a KB", "scaffold my notes repo", "initialize my wiki", "kb setup",
  "start a new knowledge base", "I want to track my notes", or otherwise wants to create
  a structured personal knowledge management system. This is the entry point for the kb
  plugin — run this first before using other kb skills.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

# KB Setup

Two-phase skill: scaffold the directory structure, then interview the user to customize.

## Phase 1: Scaffold

Create the base KB structure in the current working directory. If files already exist,
skip them — never overwrite existing content.

### Directory structure

```
sources/                # L3 — raw inputs, cold storage
├── sessions/           # /fin captures from conversations
├── syncs/              # Automated pulls from external services
│   └── <provider>/     # One dir per source (concept2/, github/, etc.)
├── notes/              # Manual markdown Rich drops in
└── tasks/              # One file per task, existence = open
    └── done/           # Archived completed tasks
wiki/                   # L2 — compiled knowledge, loaded on demand
outputs/                # Products of the system
├── surfaces/           # HTML dashboards, served over HTTP
└── reports/            # Generated briefings, analyses
private/                # Sensitive notes — never compiled into wiki
```

Create all directories:

```bash
mkdir -p sources/sessions sources/syncs sources/notes sources/tasks/done wiki outputs/surfaces outputs/reports private
```

### Starter CLAUDE.md

Write a `CLAUDE.md` at the repo root with the base structure below. Phase 2 will
add the Entity Types registry and other customizations.

```markdown
# Knowledge Base

This KB uses a multi-layer cache model. Each layer has different access patterns.
Compilation flows upward: L3 → L2 → L1.

## Cache Layers

### L1 — This file (CLAUDE.md) — Always resident
Loaded every session automatically. Contains behavioral rules, quick lookup tables,
and pointers to L2. The hot set tables below are maintained by `/compile`.

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
└── tasks/              # One file per task, existence = open
    └── done/           # Archived completed tasks
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
- **`tasks/`** — Action items. Existence = open, deletion = done.

All source docs require YAML frontmatter with at least `date`.

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

### .gitignore

Create a `.gitignore` if one doesn't exist:

```
private/
.DS_Store
```

### Initialize git

If not already a git repo, initialize one:

```bash
git init
git add -A
git commit -m "Initialize knowledge base"
```

If already a git repo, stage and commit the scaffold:

```bash
git add -A
git commit -m "Scaffold KB directory structure"
```

### Tell the user

Confirm what was created. Then transition to Phase 2.

## Phase 2: Interview

Ask the user questions to customize the KB. Be conversational — adapt based on
answers. Don't ask all questions at once; ask one or two, then follow up based on
responses.

**Skip questions the user has already answered.** If entity types, purpose, or other
details are already clear from context (e.g., stated in CLAUDE.md or conversation),
don't re-ask — just confirm and move on.

### Question flow

**Q1: Purpose**
"What's this knowledge base for?"

Examples to offer: personal notes, team lead context, project tracking, engineering
journal, customer management, learning/research.

**Q2: Entity types** (this is the critical question — dig in here)

"What kinds of things do you want to track?"

Adapt suggestions based on Q1:
- Team lead → people, projects, teams, decisions
- Project tracking → features, milestones, bugs, components
- Engineering journal → topics, technologies, patterns, til (today-i-learned)
- Customer management → customers, contacts, deals, interactions
- Personal assistant → people, projects, interests, goals, ideas
- General → topics, projects, references

For each entity type the user names, follow up to understand:
- **What fields matter?** A "person" might need role and relationship; a "project"
  might need status and owner; a "goal" might need target date and progress.
- **What sections should wiki pages have?** People might need "Current Focus" and
  "Key Contributions"; projects might need "Key Decisions" and "Timeline".
- **Does this type have a privacy dimension?** People notes might have private
  observations that shouldn't compile into wiki.

Don't make this tedious — suggest sensible defaults and let the user adjust. Offer
a proposed entity type definition and ask "does this look right, or would you change
anything?"

**Q3: Data sources**
"Do you have data sources you'd like to pull from, or is this manual-input only?"

Examples: GitHub (issues, PRs), Concept2 (rowing), Google Calendar, RSS feeds.
If manual-only, skip to Q4. If integrations, note them for CLAUDE.md but don't
configure them now — just document the intent. These will be set up as sync
providers under `sources/syncs/<provider>/`.

**Q4: Privacy**
"Anything that should stay private — not compiled into wiki pages?"

The `private/` directory already exists. This question determines what guidance goes
in CLAUDE.md about what belongs there. Also connects to entity types — if the user
tracks people, ask if private observations about people should route to `private/`.

**Q5: Nicknames** (skip if not relevant)
"Do you use shorthand or nicknames that the AI should understand?"

If yes, build a nickname decoder table for CLAUDE.md.

### Apply customizations

Based on interview answers, write the Entity Types registry and other customizations
into CLAUDE.md. This is the most important output — all other kb skills read this
section to know how to operate.

#### Entity Types registry

Add an `## Entity Types` section to CLAUDE.md. This is a machine-readable registry
that compile, fin, health-check, and other skills reference. Each entity type defines:

```markdown
## Entity Types

### people
- **wiki_path:** `wiki/people/`
- **filename:** `firstname-lastname.md`
- **frontmatter:** title, type, role, team, last_compiled, sources, related
- **sections:** Overview, Current Focus, Recent Activity, Key Contributions
- **private_notes:** yes — route to `private/firstname-lastname.md`
- **private_note_staleness:** 14 days

### projects
- **wiki_path:** `wiki/projects/`
- **filename:** `project-slug.md`
- **frontmatter:** title, type, status, last_compiled, sources, related
- **sections:** Overview, Current Status, Key Decisions, Open Questions, Timeline

### customers
- **wiki_path:** `wiki/customers/`
- **filename:** `customer-slug.md`
- **frontmatter:** title, type, status, last_compiled, sources, related
- **sections:** Overview, Integration Status, Recent Activity, Key Contacts

### topics
- **wiki_path:** `wiki/topics/`
- **filename:** `topic-slug.md`
- **frontmatter:** title, type, last_compiled, sources, related
- **sections:** Overview, Current State, History
```

The specific entity types, fields, and sections come from the interview. The above is
an example — adapt to what the user actually needs.

Key properties per entity type:
- **wiki_path** — subdirectory under `wiki/` for this type's pages
- **filename** — naming pattern for wiki pages of this type
- **frontmatter** — YAML frontmatter fields for wiki pages (always includes title, type, last_compiled, sources, related)
- **sections** — markdown sections each wiki page of this type should have
- **private_notes** (optional) — if `yes`, this entity type has private observations that route to `private/` instead of wiki. Include the filename pattern.
- **private_note_staleness** (optional) — how many days before a private note is flagged as stale by health-check. Defaults to 30 if omitted.

#### Other CLAUDE.md additions

Also add these sections based on interview answers:

1. **KB Profile** — purpose, data sources, privacy rules
2. **Nickname Decoder** (if applicable) — table mapping shorthand to entity names
3. **Labels** (if applicable) — abbreviations the user uses

#### Create wiki subdirectories

Create a subdirectory under `wiki/` for each entity type:
```bash
mkdir -p wiki/people wiki/projects wiki/interests wiki/goals wiki/ideas  # adapt to configured types
```

#### Seed INDEX.md

Write `wiki/INDEX.md` with a section for each entity type. The INDEX tracks
freshness and pinned status — this is the data structure the L2 → L1 compiler
reads to decide what goes in the CLAUDE.md hot set.

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

The `pinned` field in frontmatter is a list of page slugs that should always
appear in the CLAUDE.md hot set regardless of recency. Users can manually add
entries here or say "pin X in my hot set" to override the recency-based default.

#### Create private subdirectories

If any entity types have `private_notes: yes`, ensure `private/` exists (it already
does from Phase 1).

#### Commit customizations

```bash
git add -A
git commit -m "Customize KB: <brief summary of entity types and choices>"
```

#### Tell the user what's next

Suggest they:
- Add notes to `sources/`
- Create tasks with `/tasks`
- Run `/compile` after adding source material
- Use `/fin` at end of sessions to capture value
- Run `/health-check` to audit KB state
