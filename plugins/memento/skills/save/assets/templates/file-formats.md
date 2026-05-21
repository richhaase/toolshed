# Capture file formats

Templates for the destinations referenced in `SKILL.md` Step 5. Read this file
when you are about to write capture output. Frontmatter dates use `YYYY-MM-DD`.

## Follow-up

Path: `sources/followups/<topic-slug>.md`

Follow-ups are the most expensive capture in the Memento. Every one of them
has to be re-read on the next triage walk. Apply the `/save` follow-up bar
before writing one: the user will re-read this within a week and act on it,
and it cannot live anywhere else (issue tracker, `sources/notes/`,
`private/`, or nowhere).

```markdown
---
date: YYYY-MM-DD
kind: followup
origin: <what surfaced this — meeting, session, person, etc.>
expires_at: YYYY-MM-DD   # default: date + 14 days. /followups walk surfaces expired items first.
rationale: <one line. Why does this pass the bar — what the user would act on within a week.>
---

# <Short title — what's open>

<One short paragraph: what the open loop is and what would close it. No
"considerations," no narrative recap, no historical context. If you need
more than a paragraph, this is probably a note, not a follow-up.>
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

## Note (durable knowledge)

Path: `sources/notes/YYYY-MM-DD-topic.md`

For facts, clarifications, patterns, or lessons that should fold into the
wiki on the next `/compile`. Prefer this over a follow-up when the value
is the information itself rather than an open loop.

```markdown
---
date: YYYY-MM-DD
title: Short description
---

# [Topic]

[The knowledge worth keeping. Plain prose — /compile distills it.]
```

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

The Memento does not store tasks. Commitments belong in the user's issue
tracker (Jira, Linear, GitHub issues). If a session surfaces a real
commitment, `/save` reports it back as a one-liner so the user can file
it themselves; it does not create `sources/tasks/`.
