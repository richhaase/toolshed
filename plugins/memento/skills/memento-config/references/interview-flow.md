# Memento interview flow

Read by `memento-config` Phase 2 when a new Memento needs its purpose, entity
types, data sources, privacy rules, and nicknames established. The Update
branch (existing-Memento mode) does not run this flow.

## Q1: Purpose

"What's this memory base for?"

Examples to offer: personal notes, team lead context, project tracking,
engineering journal, customer management, learning/research.

## Q2: Entity types

This is the critical question — dig in here.

"What kinds of things do you want to track?"

Adapt suggestions based on Q1:

- Team lead → people, projects, teams, decisions
- Project tracking → features, milestones, bugs, components
- Engineering journal → topics, technologies, patterns, til (today-i-learned)
- Customer management → customers, contacts, deals, interactions
- Personal assistant → people, projects, interests, goals, ideas
- General → topics, projects, references

For each entity type the user names, follow up to understand:

- **What fields matter?** A "person" might need role and relationship; a
  "project" might need status and owner; a "goal" might need target date and
  progress.
- **What sections should wiki pages have?** People might need "Current Focus"
  and "Key Contributions"; projects might need "Key Decisions" and "Timeline".
- **Does this type have a privacy dimension?** People notes might have private
  observations that shouldn't compile into wiki.

Don't make this tedious — suggest sensible defaults and let the user adjust.
Offer a proposed entity type definition and ask "does this look right, or would
you change anything?"

## Q3: Data sources

"Do you have data sources you'd like to pull from, or is this manual-input
only?"

Examples: GitHub (issues, PRs), Concept2 (rowing), Google Calendar, RSS feeds.
If manual-only, skip to Q4. If integrations, note them in `AGENTS.md` but don't
configure them now — just document the intent. These will be set up as sync
providers under `sources/syncs/<provider>/`.

## Q4: Privacy

"Anything that should stay private — not compiled into wiki pages?"

The `private/` directory already exists. This question determines what guidance
goes in `AGENTS.md` about what belongs there. Also connects to entity types —
if the user tracks people, ask if private observations about people should
route to `private/`.

## Q5: Nicknames

Skip if not relevant.

"Do you use shorthand or nicknames that the AI should understand?"

If yes, build a nickname decoder table in `AGENTS.md`.
