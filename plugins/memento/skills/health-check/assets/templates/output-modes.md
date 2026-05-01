# Health Check output modes

Templates for the three modes referenced in `SKILL.md` Step 8. Read this file
when you are ready to format the audit results. Counts are integers; replace
all `<placeholder>` tokens with concrete values.

## Standalone mode (default)

Print the full report.

```markdown
# Health Check — YYYY-MM-DD

## Source Status (N)
Read-only validation of source lifecycle metadata and traceability.
- **sources/path.md** — invalid `status: stale`; expected active, superseded, or archived
- **sources/new.md** — supersedes missing file: sources/old.md

## Stale Research (N)
Only docs that are both past their staleness window AND actively referenced.
Recommendation for each is **re-research**, not edit-in-place.
- **doc-title** — dated YYYY-MM-DD, staleness: X (Y days overdue) · referenced from: <wiki-page or task-slug>

## Stagnant Tasks (N)
- **task-slug** — open since YYYY-MM-DD, last touched YYYY-MM-DD

## Outdated Wiki Pages (N)
- **page-name** — compiled YYYY-MM-DD, sources updated since

## Wiki Gaps (N)
- [[page-name]] — referenced from page-name.md but doesn't exist

## Wiki Contradictions (N)
- **entity** — page-a.md says X, page-b.md says Y

## Private Notes (N issues)
- **file** — last updated YYYY-MM-DD (N days ago)
- **entity** — no private note file (expected by <entity-type> definition)

## Summary
X source status issues, Y stale research docs, Z stagnant tasks,
W outdated wiki pages, V wiki gaps, U contradictions, T private note issues.
```

## Embed mode

Single section, counts + top items only. Omit categories with zero issues. If
everything is clean, print `All clear — no issues found.`

```markdown
## Health Check
N source status issues, N stale research docs, N stagnant tasks, N outdated wiki pages, N wiki gaps, N private note issues.
- Most urgent: <1-3 most important items across all categories>
```

## Triage mode prompts

Print the full standalone report first so the user sees the landscape, then
walk through actionable issues interactively, one category at a time. Skip
categories with zero issues. Wait for the user's response before moving on.
The user can always say "skip" or "stop" to end early.

### Stale research docs

> **<doc-title>** — dated YYYY-MM-DD, <N> days overdue, referenced from <location>.
> - **Re-research** — I'll dispatch a legate to refresh this
> - **Skip** — leave it for now

If the user picks re-research, invoke the research skill with the original
topic as context, specifying it's an update.

### Stagnant tasks

> **<task-slug>** — open since YYYY-MM-DD, last touched YYYY-MM-DD.
> - **Update** — what's the latest? (appends a dated entry to the task file)
> - **Close** — mark it done (move to `sources/tasks/done/`)
> - **Skip**

### Outdated wiki pages

Only offer once, not per page.

> **<N> wiki pages** have sources newer than their last compile.
> - **Recompile** — I'll run a compile to bring the wiki current
> - **Skip**

### Missing private notes

> **<entity-name>** (<entity-type>) — no private note file.
> - **Add a note** — anything to capture? (writes to `private/<filename>`)
> - **Skip**

### Stale private notes

> **<entity-name>** — last updated YYYY-MM-DD (<N> days ago).
> - **Add a note** — anything new? (appends to the existing file)
> - **Skip**

### Wiki gaps and contradictions

Informational — no inline action. List them at the end.

> **Wiki gaps:** [[page-a]], [[page-b]] — these are referenced but don't exist.
> They'll resolve on the next compile if sources mention these entities.
>
> **Contradictions:** <entity> described differently in <page-a> vs <page-b>.
> Worth checking manually.

### Wrap-up

```markdown
## Triage Complete
- Dispatched N re-research tasks
- Updated N tasks, closed N tasks
- Captured N private notes
- Recompiled wiki: yes/no
```

If any files were written or modified during triage, commit them:

```bash
git -C "$MEMENTO_ROOT" add sources/ private/
git -C "$MEMENTO_ROOT" commit -m "health-check triage: <brief summary of actions>"
```
