---
name: health-check
description: Audit the repo for staleness, contradictions, gaps, and neglected items. Checks research doc freshness, stale tasks, wiki currency, cross-link gaps, and private note recency.
user-invocable: true
allowed-tools: [Read, Glob, Grep, Bash]
---

# Health Check

Audit the knowledge base for staleness, contradictions, gaps, and neglected items. Produces a concise summary suitable for embedding in a briefing or reading standalone.

## Step 0: Get today's date and read Entity Types

Run `date '+%Y-%m-%d'` via Bash to establish the current date. All age calculations use this as "now."

Read the `## Entity Types` section from canonical `AGENTS.md`. In legacy repos
without `AGENTS.md`, fall back to `CLAUDE.md`, then `GEMINI.md`. This tells you:
- Which entity types exist and their wiki paths
- Which entity types have `private_notes: yes` and their `private_note_staleness` thresholds
- What frontmatter fields wiki pages should have (for contradiction detection)

If no context file has an Entity Types registry, use sensible defaults (30-day private note staleness, generic wiki checks).

## Step 1: Stale research docs (only if referenced)

Research documents are point-in-time captures, not living documents. The `staleness` field signals "trust this less the older it gets" — it is **not** a prompt to rewrite the doc on a schedule. A stale research doc that nothing references is not a problem; it's just an old artifact.

Only flag a research doc as stale if **both** are true:

1. The doc is past its staleness window (windows: `high` → 3d, `medium` → 10d, `low` → 30d). Compute against the `date` frontmatter field.
2. The doc is **actively referenced** somewhere that matters — i.e. it appears in a `sources:` list of a current wiki page, in another flat source doc dated within the last 14 days, or in an open task file (`sources/tasks/*.md` excluding `done/`).

Procedure:
- Glob the flat source layout your KB uses (e.g. `sources/*.md`, `sources/sessions/*.md`, `sources/notes/*.md` — match what exists). For each file with a `staleness` field, compute whether it's past its window.
- For each stale candidate, Grep for its filename or slug across `wiki/**/*.md`, recent `sources/*.md`, and `sources/tasks/*.md`. If there are no hits, **skip it** — it's an unreferenced artifact, not a maintenance issue.
- If a stale doc IS referenced, the recommendation is **re-research**, not edit-in-place. Re-running the original investigation against current data is usually the right move; patching the old doc tends to mix vintages.

Docs without a `staleness` field are not research docs — skip them.

## Step 2: Stale tasks

Glob `sources/tasks/*.md` (exclude `done/`). Read each task's frontmatter `date` field.

Flag tasks that have been open for more than 14 days. For each, note the task slug and creation date.

To check for "no updates," run `git log --format='%ai' -1 -- <file>` on each flagged task to get the last modification date. If the file hasn't been modified in 10+ days, it's considered stagnant.

## Step 3: Wiki freshness

Check if `wiki/INDEX.md` exists. If it does, read it and extract `last_compiled` from frontmatter.

Then check individual wiki pages: Glob `wiki/**/*.md` and read each page's `last_compiled` frontmatter. For each wiki page, check the `sources` list in frontmatter — Glob or stat those source files to see if any source is newer than `last_compiled`. If so, the wiki page is **outdated**.

If `wiki/INDEX.md` doesn't exist, report "Wiki not yet compiled" and skip this step.

## Step 4: Wiki cross-link gaps

If wiki pages exist, Grep all `wiki/**/*.md` for `\[\[([^\]]+)\]\]` patterns to find cross-links. For each unique linked page name, check if a corresponding file exists anywhere under `wiki/`. Collect any `[[page-name]]` references that point to non-existent pages — these are **gaps**.

If no wiki pages exist, skip this step.

## Step 5: Wiki contradictions

If wiki pages exist, scan for potential contradictions by looking for the same entity described differently in multiple wiki pages. Use the Entity Types registry to know what fields to check per type:

- For entity types with a `status` frontmatter field, check if the status in the entity's own page matches how it's described in other pages. If a project is marked `completed` in its own page but referenced as active elsewhere, flag it.
- For entity types with `role` or `team` fields, check consistency across pages.

This is best-effort — only flag clear contradictions, not minor wording differences. If no wiki pages exist, skip this step.

## Step 6: Private notes recency

Check private notes using entity type definitions from `AGENTS.md` or the legacy fallback registry.

For each entity type with `private_notes: yes`:
1. Glob `private/*.md` to find existing private note files.
2. For each file, run `git log --format='%ai' -1 -- <file>` to get the last modification date.
3. Flag notes that exceed the entity type's `private_note_staleness` threshold (default: 30 days if not specified).

Also cross-reference against known entities. If `wiki/<type_path>/` has pages for entities that should have private notes but don't have a corresponding `private/` file, flag the gap.

Do NOT read private note content — only check recency via git log. Privacy boundary applies.

## Step 7: L1 hot set staleness

Check canonical `AGENTS.md` for hot set markers (`<!-- HOT SET START -->` /
`<!-- HOT SET END -->`). Compare the hot set against the `last_compiled` date in
`wiki/INDEX.md` frontmatter. If the wiki has been compiled more recently than
the hot set was updated, `AGENTS.md` is stale — flag it.

If `CLAUDE.md` or `GEMINI.md` also contains hot set markers while `AGENTS.md`
exists, flag that as duplicated legacy state. Those harness files should be thin
entrypoints that point to `AGENTS.md`.

Also check if any pinned pages in INDEX.md no longer exist as wiki pages — these are
stale pins that should be cleaned up.

## Step 8: Produce summary

Output a concise health-check report. Two formats depending on context:

### Standalone format (when run directly)

```
# Health Check — YYYY-MM-DD

## Stale Research (N)
Only docs that are both past their staleness window AND actively referenced. Recommendation for each is **re-research**, not edit-in-place.
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
X stale research docs, Y stagnant tasks, Z outdated wiki pages, W wiki gaps, V contradictions, U private note issues.
```

### Embed format (when called from another workflow)

Single section, counts + top items only:

```
## Health Check
N stale research docs, N stagnant tasks, N outdated wiki pages, N wiki gaps, N private note issues.
- Most urgent: <1-3 most important items across all categories>
```

Omit categories with zero issues from the summary line. If everything is clean, say "All clear — no issues found."

## Guidelines

- **Read-only.** This skill never modifies files — it only reads and reports.
- **Fast over thorough.** Skip deep content analysis if it would require reading dozens of files. Frontmatter and git metadata are usually sufficient.
- **Counts matter most.** The user wants to know the scale of issues, then drill into specifics on request.
- **Don't read private note content** — only check recency via git log. Privacy boundary applies.
