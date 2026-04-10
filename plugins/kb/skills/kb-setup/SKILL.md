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
sources/           # Raw inputs — notes, research docs, decisions
├── tasks/         # One file per task, existence = open
│   └── done/      # Archived completed tasks
wiki/              # AI-compiled synthesis, topic-organized
outputs/           # Persisted reports, analyses (write-once)
private/           # Sensitive notes — never compiled into wiki
```

Create all directories:

```bash
mkdir -p sources/tasks/done wiki outputs private
```

### Starter CLAUDE.md

Write a `CLAUDE.md` at the repo root with the base structure below. Phase 2 will
add the Entity Types registry and other customizations.

```markdown
# Knowledge Base

## Directory Structure

```
sources/               # Everything the wiki compiles from
├── tasks/             # Action items — one file per task, existence = open
│   └── done/          # Archived completed tasks (optional)
└── (flat .md files)   # Decisions, research, plans — dated, with frontmatter
private/               # Sensitive notes — never compiled into wiki
wiki/                  # AI-compiled synthesis, topic-organized (maintained by /compile)
outputs/               # Persisted reports, analyses (write-once)
```

## Conventions

### Filenames
- Dated docs: `YYYY-MM-DD-topic.md` or `YYYY-MM-DD-HHmm-topic.md`
- Evergreen docs: `descriptive-name.md`

### Sources (`sources/`)
All inputs that feed the wiki.

**Tasks (`sources/tasks/`)** — One file per task: `topic-slug.md` (no date prefix — date in frontmatter). Existence = open, deletion = done. Optional `tasks/done/` for archived completed tasks.

**Flat source docs** — Decisions, research, and plans live directly in `sources/`. All require YAML frontmatter with at least `date`. Research docs additionally require `topic`, `tags`, `sources`, and `staleness` fields.

### Private (`private/`)
- Sensitive or personal notes
- Never compiled into wiki — privacy boundary

### Wiki (`wiki/`)
- AI-compiled synthesis maintained by `/compile`
- Topic-organized, not date-organized — each topic gets its own .md file
- `INDEX.md` lists every wiki page with a one-line description and last-updated date

### Outputs (`outputs/`)
- Persisted reports, analyses, and generated content
- Write-once — never overwrite; create a new timestamped file if needed

## Lookup Hierarchy

When you need context about a topic — **follow this order**:

1. **`wiki/`** — Compiled, synthesized knowledge. Start with `wiki/INDEX.md`.
2. **`sources/`** — Raw data the wiki compiles from. Use when wiki is stale or missing detail.
3. **Ask the user** — If neither wiki nor sources have what you need, ask.

## Agent Rules

- **Local-only repo** — Commit freely. No remote pushes unless explicitly asked.
- **No unsolicited changes** — Don't reorganize, rename, or "improve" files without being asked.
- **Outputs are immutable** — Files in `outputs/` are write-once. Never overwrite.
- **Private is private** — Never read `private/` contents into wiki or outputs.
- **Additive edits** — When updating wiki pages, add new information. Never delete historical content unless explicitly asked.
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
- General → topics, projects, references

For each entity type the user names, follow up to understand:
- **What fields matter?** A "person" might need role and team; a "customer" might need
  status and account tier; a "project" might need status and owner.
- **What sections should wiki pages have?** People might need "Current Focus" and
  "Key Contributions"; projects might need "Key Decisions" and "Timeline".
- **Does this type have a privacy dimension?** People notes might have private
  observations that shouldn't compile into wiki.

Don't make this tedious — suggest sensible defaults and let the user adjust. Offer
a proposed entity type definition and ask "does this look right, or would you change
anything?"

**Q3: Data sources**
"Do you have data sources you'd like to pull from, or is this manual-input only?"

Examples: GitHub (issues, PRs), Slack (channels), Jira, email, calendar, RSS feeds.
If manual-only, skip to Q4. If integrations, note them for CLAUDE.md but don't
configure them now — just document the intent.

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
mkdir -p wiki/people wiki/projects wiki/customers wiki/topics  # example
```

#### Seed INDEX.md

Write `wiki/INDEX.md` with a section for each entity type:

```markdown
---
title: Wiki Index
date: <today>
---

# Wiki Index

## People
_No pages compiled yet._

## Projects
_No pages compiled yet._

## Customers
_No pages compiled yet._

## Topics
_No pages compiled yet._

---
_Run `/compile` to build wiki from sources._
```

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
