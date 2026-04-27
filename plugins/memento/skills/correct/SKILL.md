---
name: correct
description: Correct or archive Memento source material while preserving history. Use when the user says prior memory is wrong, stale, superseded, archived, or should no longer shape current synthesis.
argument-hint: "<source or topic>"
user-invocable: true
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

# Correct

Preserve history while preventing stale source material from shaping current
synthesis.

## Memento root

Resolve the Memento data root before reading or writing:

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
../_shared/scripts/memento-run pwd
```

Write only under `sources/`. Do not edit `wiki/` or `AGENTS.md`; run `compile`
afterward if current-state surfaces need refreshing.

## Source statuses

Use these frontmatter fields:

```yaml
---
status: active|superseded|archived
supersedes:
  - sources/path-to-old-source.md
superseded_by: sources/path-to-new-source.md
archive_note: "Why this no longer represents current state"
correction_note: "What changed and why"
---
```

## Workflow

1. Locate the source file(s) by path or topic with `rg`.
2. If replacing incorrect or stale information, create a new active source in
   `sources/notes/` with the corrected facts and `supersedes` pointing to the
   old source.
3. Edit the old source frontmatter to set `status: superseded`,
   `superseded_by: <new-source>`, and `correction_note`.
4. If the source should be kept only for history with no replacement, set
   `status: archived` and add `archive_note`.
5. Preserve body content. Do not delete old source files.
6. Commit source changes:

```bash
git -C "$MEMENTO_ROOT" add sources/
git -C "$MEMENTO_ROOT" commit -m "correct: update source status for <topic>"
```

## Output

Report the files changed, status transitions, and whether `compile` should be
run to remove stale material from current wiki and hot-set surfaces.
