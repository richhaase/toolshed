---
name: recall
description: Read-only recall workflow for Memento. Use when the user asks what we know, asks to look up local context, or wants prior notes without creating new research.
argument-hint: "<query>"
user-invocable: true
allowed-tools: [Read, Glob, Grep, Bash]
---

# Recall

Retrieve existing Memento context without writing files.

## Memento root

Resolve the Memento data root before reading:

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
../_shared/scripts/memento-run pwd
```

All paths below are relative to `MEMENTO_ROOT`. Do not read `private/` unless
the user explicitly asks for private notes and the active repo's `AGENTS.md`
allows that category.

## Search order

Follow the cache hierarchy, stopping when the answer is sufficient:

1. **L1: `AGENTS.md` hot set** — read `AGENTS.md`, especially the quick
   reference between hot-set markers.
2. **L2: `wiki/`** — search `wiki/INDEX.md`, then matching `wiki/**/*.md`.
3. **L3: `sources/`** — search `sources/**/*.md` only when L1/L2 are missing,
   stale, or insufficient.

Use `rg` for search and read only the files needed to answer. Exclude
`sources/**/*.md` whose frontmatter says `status: superseded` or
`status: archived` from current-state answers. You may mention those files under
"history" or "superseded context" when useful.

## Output

Answer with:
- The current-state answer first.
- Source path citations for the files used.
- A short note when the answer depends on stale, superseded, archived, or
  missing context.

This skill is read-only. Never create, edit, archive, or compile files.
