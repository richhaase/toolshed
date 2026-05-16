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
Bundle research findings into the session capture; for long-form
investigation work prefer dispatching a separate research session and
saving it afterward.

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

Path: `sources/tasks/<topic-slug>.md` — short, descriptive, scannable in a
directory listing. No date prefix (date lives in frontmatter). Use lowercase
with hyphens.

Pick the weight based on what the user gives you.

**Simple task** (one-liner, no extra context needed):

```markdown
---
date: YYYY-MM-DD
---
# Review API rate limiting configuration
```

**Complex task** (has context, subtasks, links, or needs explanation):

```markdown
---
date: YYYY-MM-DD
---
# Evaluate database migration strategy

Came out of architecture discussion. Need to compare approaches before
committing to a migration path.

## Context
- Current schema has grown organically, needs cleanup
- Performance issues on key queries
- Team has time in the next sprint

## Subtasks
- [ ] Benchmark current query performance
- [ ] Prototype alternative schema
- [ ] Get cost estimate for migration downtime
```

Before creating, glob `sources/tasks/*.md` to check for duplicates or related
tasks. If something similar exists, update the existing task instead of
creating a new one.

For updates to existing tasks, edit the file directly. The `followups` skill
handles review (mark done, demote, dismiss, add note, promote from
follow-up).
