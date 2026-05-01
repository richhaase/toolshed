# Capture file formats

Templates for the destinations referenced in `SKILL.md` Step 5. Read this file
when you are about to write capture output. Frontmatter dates use `YYYY-MM-DD`.

## Follow-up

Path: `sources/followups/<topic-slug>.md`

```markdown
---
date: YYYY-MM-DD
kind: followup
origin: <what surfaced this — meeting, session, person, etc.>
---

# <Short title — what's open>

<One or two paragraphs: what the thing is, why it might matter, what would
move it forward. Do not phrase as a directive.>
```

For updates to existing follow-ups, append a dated entry under a `## Notes`
section rather than rewriting the body.

## Decision

Path: `sources/sessions/YYYY-MM-DDTHHmmss-topic.md`

```markdown
---
date: YYYY-MM-DD
topic: Short description
---

# Decision: [Topic]

## Context
## Decision
## Alternatives considered
## Implications
```

## Research

Path: `sources/sessions/YYYY-MM-DDTHHmmss-topic.md`

Dated filename, YAML frontmatter with `topic`, `tags`, `sources`, `staleness`.
For full research output (not casual session capture), prefer the `research`
skill — it enforces the canonical format.

## Analysis

Path: `outputs/reports/YYYY-MM-DDTHHmmss-topic.md`

```markdown
---
date: YYYY-MM-DD
topic: Short description
---

# [Topic]

[Content]
```

## Private note

Path: `private/<filename-pattern>` (filename pattern comes from Entity Types
registry). Append — never overwrite. Create the file if it does not exist.

```markdown
## YYYY-MM-DD

<Observation or note>
```

## Tasks

Use the `tasks` skill for task creation — do not write task files inline.
For updates to existing tasks, edit the file directly.
