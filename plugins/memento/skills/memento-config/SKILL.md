---
name: memento-config
description: >
  Set up a new Memento or update the configuration of an existing one — idempotent
  surface for both. Creates the directory structure (sources, wiki, outputs, private)
  on first run, generates canonical AGENTS.md context plus thin harness entrypoints,
  and interviews the user to customize entity types, profile, nicknames, and labels.
  On an existing Memento, detects current state and offers a targeted update branch
  (add an entity type, modify an entity type, update profile, update nicknames,
  re-scaffold missing dirs). Use when the user says "set up a knowledge base",
  "create a Memento", "scaffold my notes repo", "initialize my wiki", "memento setup",
  "memento config", "configure my memento", "add an entity type", "update my memento
  config", "modify my memento", or otherwise wants to bootstrap or tune the Memento.
  This is the entry point for the memento plugin.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

# Memento Config

Idempotent setup-and-update surface for the Memento. On a fresh directory,
scaffolds and interviews. On an existing Memento, detects current state and
offers a targeted update menu.

## Memento root

`memento-config` is the entry point that creates or selects the Memento data root.

Use the bundled resolver when a root may already be configured:

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root 2>/dev/null || true)"
```

If the user gives a target directory, use that as `MEMENTO_ROOT`. If they ask for a
global Memento and do not give a path, ask for the location. If they just ask to set
up the current repo, use the current working directory.

For global plugin use, support either configuration method:

- `MEMENTO_ROOT=/path/to/memento` in the user's shell environment.
- A `.memento-root` file in any project repo containing `/path/to/memento` or a relative path.

After choosing `MEMENTO_ROOT`, run filesystem and git commands against that directory
with absolute paths or `git -C "$MEMENTO_ROOT" ...`. Script paths are shown relative
to this `SKILL.md`; if your shell is in another directory, invoke the same
scripts by absolute path.

## Phase 0: Detect mode

Before scaffolding, check whether `MEMENTO_ROOT` already looks like a
configured Memento. The signal is a canonical `AGENTS.md` containing an
`## Entity Types` section (legacy repos may have it in `CLAUDE.md`).

```bash
if grep -q '^## Entity Types' "$MEMENTO_ROOT/AGENTS.md" 2>/dev/null \
   || grep -q '^## Entity Types' "$MEMENTO_ROOT/CLAUDE.md" 2>/dev/null; then
  MODE=update
else
  MODE=new
fi
```

- **`MODE=new`** → run Phase 1 (scaffold) followed by Phase 2 (full
  interview). This is the original setup flow.
- **`MODE=update`** → skip Phase 1's scaffold writes (they're already
  there) but still run the idempotent `mkdir -p` to backfill any
  missing directories. Then enter the **Update branch** below instead
  of the full interview.

In any mode, never overwrite existing `AGENTS.md`, `CLAUDE.md`,
`.gitignore`, or wiki content. Edits are surgical — add what's missing,
amend what the user changes — never replace the file wholesale.

## Phase 1: Scaffold

Create the base Memento structure in `MEMENTO_ROOT`. If files already exist, skip them —
never overwrite existing content.

### Directory structure

```
sources/                # L3 — raw inputs, cold storage
├── sessions/           # /save captures from conversations
├── syncs/              # Automated pulls from external services
│   └── <provider>/     # One dir per source (concept2/, github/, etc.)
├── notes/              # Manual markdown Rich drops in
├── tasks/              # One file per task — user-committed actions
│   └── done/           # Archived completed tasks
└── followups/          # One file per follow-up — uncommitted captures
                        # (open questions, awareness items, loose ends)
wiki/                   # L2 — compiled knowledge, loaded on demand
outputs/                # Products of the system
├── surfaces/           # HTML dashboards, served over HTTP
└── reports/            # Generated briefings, analyses
private/                # Sensitive notes — never compiled into wiki
```

Create all directories:

```bash
mkdir -p "$MEMENTO_ROOT"/sources/sessions "$MEMENTO_ROOT"/sources/syncs "$MEMENTO_ROOT"/sources/notes "$MEMENTO_ROOT"/sources/tasks/done "$MEMENTO_ROOT"/sources/followups "$MEMENTO_ROOT"/wiki "$MEMENTO_ROOT"/outputs/surfaces "$MEMENTO_ROOT"/outputs/reports "$MEMENTO_ROOT"/private
```

### Starter context files

Write canonical `AGENTS.md` at the repo root with the base structure below.
Phase 2 will add the Entity Types registry and other customizations. If
`AGENTS.md` already exists, never overwrite it; merge the missing Memento sections
instead.

Write `CLAUDE.md` only as a thin harness entrypoint that tells Claude Code to
read `AGENTS.md`. Do not duplicate the Memento operating model, Entity Types
registry, or hot set into that file.

If setting up a legacy repo that already has a full `CLAUDE.md` but no
`AGENTS.md`, preserve the full Memento context by moving or copying it into
`AGENTS.md`, then replace `CLAUDE.md` with the thin entrypoint only after the
canonical content is safely present in `AGENTS.md`.

Use the starter scaffolds in `references/agents-md-template.md` for the
canonical `AGENTS.md` and the thin `CLAUDE.md` pointer. Read that file and
copy the starter blocks into the new repo, preserving placeholder markers
(`<!-- HOT SET START/END -->`) for `/compile` to fill.

### .gitignore

Create a `.gitignore` if one doesn't exist:

```
private/
.DS_Store
```

### Initialize git

If not already a git repo, initialize one:

```bash
git -C "$MEMENTO_ROOT" init
git -C "$MEMENTO_ROOT" add -A
git -C "$MEMENTO_ROOT" commit -m "Initialize memory base"
```

If already a git repo, stage and commit the scaffold:

```bash
git -C "$MEMENTO_ROOT" add -A
git -C "$MEMENTO_ROOT" commit -m "Scaffold Memento directory structure"
```

### Optional project pointer

If the user wants this global Memento available from a project repo, write `.memento-root`
in that project repo with the chosen `MEMENTO_ROOT` path. Do this only when the user
asks for the pointer or confirms the target project. Do not overwrite an existing
`.memento-root` without asking.

### Tell the user

Confirm what was created. Then transition to Phase 2.

## Phase 2: Interview

Ask the user questions to customize the Memento. Be conversational — adapt based on
answers. Don't ask all questions at once; ask one or two, then follow up based on
responses.

**Skip questions the user has already answered.** If entity types, purpose, or other
details are already clear from context (e.g., stated in `AGENTS.md` or conversation),
don't re-ask — just confirm and move on.

### Question flow

**Q1: Purpose**
"What's this memory base for?"

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
If manual-only, skip to Q4. If integrations, note them in `AGENTS.md` but don't
configure them now — just document the intent. These will be set up as sync
providers under `sources/syncs/<provider>/`.

**Q4: Privacy**
"Anything that should stay private — not compiled into wiki pages?"

The `private/` directory already exists. This question determines what guidance goes
in `AGENTS.md` about what belongs there. Also connects to entity types — if the user
tracks people, ask if private observations about people should route to `private/`.

**Q5: Nicknames** (skip if not relevant)
"Do you use shorthand or nicknames that the AI should understand?"

If yes, build a nickname decoder table in `AGENTS.md`.

### Apply customizations

Based on interview answers, write the Entity Types registry and other
customizations into `AGENTS.md`. `CLAUDE.md` should remain a thin harness
entrypoint that points to `AGENTS.md`. This is the most important output — all
other memento skills read `AGENTS.md` to know how to operate.

#### Entity Types registry

Add an `## Entity Types` section to `AGENTS.md`. This is a machine-readable registry
that `compile`, `save`, `ama`, and `followups` reference. Each entity type defines:

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

The specific entity types, fields, and sections come from the interview. The above is
an example — adapt to what the user actually needs.

Key properties per entity type:
- **wiki_path** — subdirectory under `wiki/` for this type's pages
- **filename** — naming pattern for wiki pages of this type
- **frontmatter** — YAML frontmatter fields for wiki pages (always includes title, type, sources, related; do not include `last_compiled`, because freshness belongs in `wiki/INDEX.md`)
- **sections** — markdown sections each wiki page of this type should have
- **private_notes** (optional) — if `yes`, this entity type has private observations that route to `private/` instead of wiki. Include the filename pattern.

#### Other `AGENTS.md` additions

Also add these sections based on interview answers:

1. **Memento Profile** — purpose, data sources, privacy rules
2. **Nickname Decoder** (if applicable) — table mapping shorthand to entity names
3. **Labels** (if applicable) — abbreviations the user uses

#### Create wiki subdirectories

Create a subdirectory under `wiki/` for each entity type:
```bash
mkdir -p "$MEMENTO_ROOT"/wiki/people "$MEMENTO_ROOT"/wiki/projects "$MEMENTO_ROOT"/wiki/interests "$MEMENTO_ROOT"/wiki/goals "$MEMENTO_ROOT"/wiki/ideas  # adapt to configured types
```

#### Seed INDEX.md

Write `wiki/INDEX.md` with a section for each entity type. The INDEX tracks
freshness and pinned status — this is the data structure the L2 → L1 compiler
reads to decide what goes in the `AGENTS.md` hot set.

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
appear in the `AGENTS.md` hot set regardless of recency. Users can manually add
entries here or say "pin X in my hot set" to override the recency-based default.

#### Create private subdirectories

If any entity types have `private_notes: yes`, ensure `private/` exists (it already
does from Phase 1).

#### Commit customizations

```bash
git -C "$MEMENTO_ROOT" add -A
git -C "$MEMENTO_ROOT" commit -m "Customize Memento: <brief summary of entity types and choices>"
```

#### Tell the user what's next

Suggest they:
- Add notes to `sources/`
- Use `/save` at end of sessions to capture value (decisions, tasks,
  follow-ups, research, analyses, private notes)
- Use `/ama` when they want the agent to interview them and fill gaps
  in the wiki
- Run `/compile` after adding source material to refresh the wiki and
  the `AGENTS.md` hot set
- Run `/followups` periodically to walk open tasks and follow-ups

## Update branch (entered when MODE=update)

The Memento already has an `## Entity Types` registry. Don't re-run
the full new-Memento interview. Instead, ask one top-level question:

> "What would you like to change?"

Offer these options via `AskUserQuestion`:

- **Add an entity type** — collect type name, `wiki_path`, `filename`
  pattern, `frontmatter` fields, `sections`, optional
  `private_notes`. Append the new entity to the `## Entity Types`
  registry in `AGENTS.md`. Create the matching `wiki/<type>/`
  directory. Add a section header for the type to `wiki/INDEX.md`
  if not already present. Suggest `/compile full` so existing
  sources get reorganized.
- **Modify an entity type** — read the existing registry, ask which
  type to change, ask what changes (rename type, add/remove
  frontmatter fields, add/remove sections, toggle `private_notes`).
  Edit the registry in place. Surgical edit only — do not rewrite
  surrounding content.
- **Update the Memento Profile** — purpose statement, data sources,
  privacy rules. Edit the `Memento Profile` section in `AGENTS.md`.
- **Update nicknames / labels** — edit the corresponding tables in
  `AGENTS.md`. Add, remove, or change rows surgically.
- **Re-scaffold missing directories** — run the idempotent `mkdir -p`
  pass against the canonical structure. No-op if everything is
  already present.

After the targeted edit, commit:

```bash
git -C "$MEMENTO_ROOT" add -A
git -C "$MEMENTO_ROOT" commit -m "config: <one-line summary of what changed>"
```

If the user wants more changes, loop the top-level question. When
they're done, exit.

### Update-branch guidelines

- **Surgical, not destructive.** Existing wiki pages, sources, and
  hot set tables stay intact. Updates touch only the registry, profile,
  or nickname/label tables they target.
- **Show before applying.** For modifications, show the current entity
  type definition and the proposed change side-by-side before
  editing. Confirm with the user.
- **Dropping an entity type is heavy.** Ask explicitly whether to also
  delete the corresponding `wiki/<type>/` directory or leave it as
  legacy data. Default to leaving it alone.
- **Renaming an entity type** affects every wiki page, source
  reference, and hot set entry of that type. Treat as heavy. Confirm
  the user actually wants to do this and recommend running
  `/compile full` after.
