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
sources/           # Raw inputs — notes, synced data, research docs
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

Write a `CLAUDE.md` at the repo root with the following content. This file teaches
future AI sessions how to work with this KB.

```markdown
# Knowledge Base

## Directory structure

- `sources/` — Raw inputs: notes, synced data, research docs. The ground truth.
  - `sources/tasks/` — One markdown file per open task. File existence = task is open.
  - `sources/tasks/done/` — Archived completed tasks.
- `wiki/` — AI-compiled synthesis pages, organized by topic/entity. Generated from sources.
- `outputs/` — Persisted reports and analyses. Write-once, never modified after creation.
- `private/` — Sensitive notes. Never compiled into wiki or referenced in outputs.

## Conventions

### Files
- All content files are Markdown with YAML frontmatter.
- Filenames: lowercase, hyphens, no spaces. Tasks: `topic-slug.md`. Research: `YYYY-MM-DD-HHmm-topic-slug.md`.
- Frontmatter is required: at minimum `title` and `date`.

### Lookup hierarchy
When asked about a topic:
1. Check `wiki/` for compiled synthesis
2. Check `sources/` for raw material
3. Ask the user if nothing found

### Agent rules
- **Local only** — no remote pushes unless explicitly asked.
- **No unsolicited changes** — don't reorganize, rename, or "improve" files without being asked.
- **Outputs are immutable** — never modify files in `outputs/` after creation.
- **Private is private** — never read `private/` contents into wiki or outputs.
- **Additive edits** — when updating wiki pages, add new information. Never delete historical content unless explicitly asked.
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

Ask the user 3-5 questions to customize the KB. Be conversational — adapt based on
answers. Don't ask all questions at once; ask one or two, then follow up based on
responses.

### Question flow

**Q1: Purpose**
"What's this knowledge base for?"

Examples to offer: personal notes, team lead context, project tracking, engineering
journal, customer management, learning/research.

**Q2: Entities**
"What kinds of things do you want to track?"

Adapt based on Q1. Suggest relevant entity types:
- Team lead → people, projects, teams, decisions
- Project tracking → features, milestones, bugs, components
- Engineering journal → topics, technologies, patterns, til (today-i-learned)
- Customer management → customers, contacts, deals, interactions
- General → topics, projects, references

**Q3: Data sources**
"Do you have data sources you'd like to pull from, or is this manual-input only?"

Examples: GitHub (issues, PRs), Slack (channels), Jira, email, calendar, RSS feeds.
If manual-only, skip to Q4. If integrations, note them for CLAUDE.md but don't
configure them now — just document the intent.

**Q4: Privacy**
"Anything that should stay private — not compiled into wiki pages?"

The `private/` directory already exists. This question determines what guidance goes
in CLAUDE.md about what belongs there. Examples: personal notes about people, salary
info, credentials, draft communications.

**Q5: Organization** (skip if answers are clear enough)
"How do you want wiki pages organized — by entity type (people/, projects/), flat, or
something custom?"

### Apply customizations

Based on interview answers, update the KB:

1. **Update CLAUDE.md** — Add a "KB profile" section with:
   - Purpose description
   - Entity types tracked
   - Data sources (if any)
   - Privacy rules
   - Wiki organization scheme

2. **Create wiki subdirectories** matching the chosen organization:
   ```bash
   mkdir -p wiki/people wiki/projects  # example
   ```

3. **Seed an INDEX.md** in `wiki/`:
   ```markdown
   ---
   title: Wiki Index
   date: <today>
   ---

   # Wiki Index

   ## Categories

   - [People](people/) — Team members, contacts, stakeholders
   - [Projects](projects/) — Active and past projects

   ## Recent updates

   _No pages compiled yet. Run `/compile` to build wiki from sources._
   ```

4. **Commit customizations**:
   ```bash
   git add -A
   git commit -m "Customize KB: <brief summary of choices>"
   ```

5. **Tell the user what's next** — suggest they:
   - Add notes to `sources/`
   - Create tasks with `/tasks`
   - Run `/compile` after adding source material
   - Use `/fin` at end of sessions to capture value
