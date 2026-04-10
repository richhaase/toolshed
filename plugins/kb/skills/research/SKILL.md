---
name: research
description: >
  Create and manage research documents in the knowledge base. Supports recall (checking
  existing docs before researching), staleness tracking, source attribution, and updates.
  Use when the user says "research", "look into", "investigate", "what do we know about",
  "find out about", "dig into", "write up findings", "update research on", "is our info
  on X still current", or wants to create, find, or update research documentation. Also
  triggers on "recall" or "what do we know" to check existing knowledge before starting
  new research.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Agent
  - WebSearch
  - WebFetch
---

# Research

Research documents with recall, staleness tracking, and source attribution. Every
research doc records where information came from and when it expires.

## Recall phase

Before starting new research, always check existing knowledge:

1. **Search wiki** for the topic:
   ```bash
   grep -rl "<topic>" wiki/ 2>/dev/null
   ```

2. **Search sources** for prior research:
   ```bash
   grep -rl "<topic>" sources/ 2>/dev/null | grep -v tasks/
   ```

3. **Report findings** to the user:
   - If fresh research exists (within staleness window), present it. Ask if they want
     an update or if the existing doc answers their question.
   - If stale research exists, note it and offer to refresh.
   - If no prior research, proceed to new research.

## Staleness model

Every research doc has a staleness rating in frontmatter:

| Rating | Window | Use for |
|--------|--------|---------|
| `high` | 3 days | Fast-moving topics: prices, API status, release notes |
| `medium` | 10 days | Moderate topics: competitor analysis, project status |
| `low` | 30 days | Stable topics: architectural decisions, historical facts |

A doc is **stale** when `today - date > staleness window`.

When creating a research doc, choose the staleness rating based on how quickly the
information is likely to change. Default to `medium` if unsure.

## Creating a research doc

### Filename

`YYYY-MM-DD-HHmm-topic-slug.md`

Use the current date and time. The timestamp ensures uniqueness and chronological
sorting.

```bash
date +%Y-%m-%d-%H%M
```

### Template

```markdown
---
title: <Research topic>
date: <ISO 8601 timestamp>
topic: <topic keyword>
tags: [<tag1>, <tag2>]
sources:
  - description: <Source name or URL>
    accessed: <ISO 8601 date>
  - description: <Another source>
    accessed: <ISO 8601 date>
staleness: <high|medium|low>
---

# <Research topic>

## Summary
<2-3 sentence executive summary of findings>

## Findings
<Detailed findings organized by subtopic>

## Open questions
<What wasn't answered, what needs follow-up>

## Sources
<Formatted source list with access dates and notes on reliability>
```

### Process

1. Perform the recall phase (above).
2. Conduct research using available tools (web search, file reading, etc.).
3. Write the research doc to `sources/`.
4. Commit:
   ```bash
   git add sources/
   git commit -m "research: <topic>"
   ```
5. Report findings to the user.

## Updating a research doc

When refreshing an existing research doc:

1. Read the existing doc.
2. Conduct new research.
3. Update the doc:
   - **Bump the date** in frontmatter to today.
   - **Revise content** with new findings.
   - **Preserve old sources** — add new sources, don't remove old ones.
   - **Add update note** at the top of the body:
     ```markdown
     > Updated <date>: <what changed>
     ```
4. Commit:
   ```bash
   git add sources/
   git commit -m "research: update <topic>"
   ```

## Source attribution

Every piece of external information must have a source entry:

```yaml
sources:
  - description: "GitHub API documentation"
    accessed: 2025-01-15
  - description: "https://example.com/article"
    accessed: 2025-01-15
```

If information comes from conversation with the user, attribute it:

```yaml
sources:
  - description: "User (direct input)"
    accessed: 2025-01-15
```

## Guidelines

- **Recall first.** Always check existing docs before researching. The user may not
  remember what's already in the KB.
- **Source everything.** No unsourced claims in research docs.
- **Be honest about confidence.** If information is uncertain, say so.
- **Staleness is a feature.** Setting the right staleness rating saves future effort.
- **Don't over-research.** Answer the question, note open items, move on.
