---
name: health-check
description: >
  Audit the knowledge base for staleness, gaps, contradictions, and structural issues.
  Read-only — never modifies files. Use when the user says "health check", "audit",
  "check my KB", "what's stale", "KB status", "anything out of date", "knowledge base
  health", "check for issues", or wants to understand the current state and quality of
  their knowledge base. Supports two output formats: standalone (detailed report) and
  embed (compact summary for inclusion in other outputs).
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# Health Check

Read-only audit of KB health. Fast over thorough — use frontmatter and git metadata
rather than deep content analysis. Never modifies files.

## Checks

### 1. Stale research

Find research docs past their staleness window.

For each `.md` file in `sources/` (excluding `tasks/` and `private/`):
1. Read frontmatter for `date` and `staleness` rating
2. Calculate age: `today - date`
3. Compare against staleness window:
   - `high`: stale after 3 days
   - `medium`: stale after 10 days
   - `low`: stale after 30 days
4. Flag stale docs

### 2. Stagnant tasks

Find tasks that have been open too long without updates.

```bash
ls -1 sources/tasks/*.md 2>/dev/null | grep -v done/
```

For each task:
1. Read frontmatter for `date`
2. Check git log for last modification:
   ```bash
   git log -1 --format="%ai" -- "sources/tasks/<file>"
   ```
3. Flag tasks with no activity in >14 days

### 3. Outdated wiki pages

Find wiki pages that haven't been recompiled since their sources changed.

For each wiki page:
1. Read frontmatter for `last_compiled` and `sources` list
2. For each listed source, check if it was modified after `last_compiled`:
   ```bash
   git log -1 --format="%ai" -- "<source-path>"
   ```
3. Flag pages where sources are newer than last compile

### 4. Broken cross-links

Check for references between wiki pages that point to non-existent pages.

For each wiki page:
1. Scan for markdown links: `[text](path)`
2. Verify the target file exists
3. Flag broken links

### 5. Contradictions (light check)

Look for obvious conflicts — same entity with different states across pages. This is
a heuristic check, not deep semantic analysis:

1. Find entities mentioned in multiple wiki pages
2. Compare `Current state` sections for conflicting information
3. Flag potential contradictions with source references

Only run this check in standalone mode (skip in embed mode).

## Output formats

### Standalone (default)

Detailed report for the user:

```markdown
## KB Health Check — <date>

### Summary
- **Research docs:** <total> total, <stale> stale
- **Open tasks:** <total> total, <stagnant> stagnant
- **Wiki pages:** <total> total, <outdated> outdated
- **Broken links:** <count>
- **Potential contradictions:** <count>

### Stale research
| Doc | Age | Staleness | Status |
|-----|-----|-----------|--------|
| topic.md | 15 days | medium (10d) | STALE |

### Stagnant tasks
| Task | Created | Last activity |
|------|---------|---------------|
| task.md | 2025-01-01 | 20 days ago |

### Outdated wiki pages
| Page | Last compiled | Sources changed |
|------|---------------|-----------------|
| entity.md | 2025-01-01 | 2 sources modified since |

### Broken links
- `wiki/foo.md` links to `wiki/bar.md` (not found)

### Potential contradictions
- Entity "X" described as "active" in `page-a.md` but "deprecated" in `page-b.md`

### Recommendations
1. Refresh stale research: <list>
2. Review stagnant tasks: <list>
3. Run `/compile` to update wiki pages
```

### Embed (compact)

Short summary for inclusion in other outputs (e.g., session start):

```
KB: 12 sources, 8 wiki pages, 3 tasks | 1 stale doc, 0 stagnant tasks | Last compile: 2 days ago
```

Use embed format when the user asks for a quick status or when health check is part
of another workflow.

## Determining format

- Default to **standalone** when the user directly asks for a health check.
- Use **embed** when health check is mentioned as part of another request, or when
  the user asks for a "quick" or "brief" status.
- The user can explicitly request either: "detailed health check" → standalone,
  "quick health check" → embed.

## Performance

- **Frontmatter first.** Read only frontmatter (first ~10 lines) for most checks.
  Don't read full file contents unless needed for contradiction checks.
- **Git metadata.** Use `git log` for modification dates rather than filesystem mtime.
- **Batch operations.** Run git commands in batches, not per-file.
- **Skip private.** Never read or report on `private/` contents.
