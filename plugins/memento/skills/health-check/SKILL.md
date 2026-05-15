---
name: health-check
description: Audit a Memento for cache drift, stale projections, broken evidence paths, privacy-boundary risks, compile metadata drift, open queue visibility, or golden-query eval readiness. Use when the user asks for a health check, doctor, audit, staleness check, provenance check, privacy lint, L1/L2/L3 integrity check, or whether a Memento is current. Read-only by default; never reads private/.
argument-hint: "[doctor|privacy|eval|fixtures|full]"
user-invocable: true
allowed-tools: Read Glob Grep Bash
---

# Memento Health Check

Run read-only diagnostics on a Memento. This skill exists to keep the L3 -> L2 ->
L1 cache model honest: L1 (`AGENTS.md`) and L2 (`wiki/`) are generated
projections over L3 sources, not authority.

## Memento root

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
```

See `../_shared/references/memento-root.md` for the full resolution contract.
All Memento paths below (`sources/`, `wiki/`, `AGENTS.md`, `data/`) are
relative to `MEMENTO_ROOT`.

## Arguments

Arguments are passed as: $ARGUMENTS

- No arguments or `doctor` -> run the core read-only doctor checks.
- `privacy` -> focus on public-surface privacy lint and forbidden-path leakage.
- `eval` -> assess or draft local golden-query fixture coverage.
- `fixtures` -> inspect compile/eval fixture readiness if the repo has them.
- `full` -> run all applicable checks.

## Non-negotiable rules

- **Never read `private/`.** Do not count, list, hash, grep, or path-reference
  private files. Treat `private/` as outside the health-check input set.
- **Do not write by default.** Print findings to the user. If the user asks to
  persist a report, propose a destination first; prefer `private/` for raw
  diagnostics that may expose sensitive paths or titles.
- **Do not modify wiki or sources.** This skill diagnoses; it does not repair.
- **No network, servers, embeddings, or external memory stores.**
- **Generated artifacts are not authority.** Any index, eval, report, or doctor
  output is disposable evidence about the cache, not part of the cache.
- **Privacy policy outranks every cache layer.** If L1/L2 say something that
  conflicts with source classification or privacy rules, report the conflict.

## Core diagnosis

For the core doctor pass, prefer the deterministic helper when available:

```bash
skills/health-check/scripts/doctor.sh
```

Use the scripted output as a first pass, then apply the judgment rules below to
filter false positives and explain the findings. If the script is unavailable,
run the checks manually.

Start with the public root files:

1. Read `AGENTS.md` if present, otherwise `CLAUDE.md`.
2. Read `wiki/INDEX.md` if present.
3. Inspect public `sources/` Markdown only. Exclude `sources/tasks/done/` for
   current-state freshness checks, but it may be used for task-shape checks when
   explicitly relevant.
4. Inspect `data/` only as a domain store, not as generic memory. A skill or
   source should establish what data file is canonical.

### Check 1: Freshness Drift

Compare the wiki index freshness to active public sources:

- `wiki/INDEX.md` frontmatter `last_compiled`.
- `wiki/INDEX.md` frontmatter `last_compile_commit` when the Memento is a git
  repo.
- Per-page `Last Updated` dates in `wiki/INDEX.md`.
- Active source dates and filesystem/git changes newer than the last compile.

Report pages or hot-set entries that appear older than active L3 evidence. Do
not call this a definitive stale answer unless the source clearly touches the
same entity or topic; otherwise mark it as "needs compile/routing review."

### Check 2: Broken Evidence Paths

Validate inspectable public paths:

- `sources:` frontmatter entries in wiki pages.
- Hot-set Details paths in `AGENTS.md`.
- Inline backtick paths that look canonical, especially `sources/...`,
  `wiki/...`, `data/...`, `outputs/...`, and skill paths.
- `related:` wiki links and `[[wikilinks]]`.

Missing evidence paths are high-value findings because they break verification.

### Check 3: Compile Metadata Drift

Check whether the Memento state matches current compile-skill expectations:

- `wiki/INDEX.md` should carry `last_compile_commit` in git-backed Mementos.
- Per-page wiki frontmatter should not carry `last_compiled`; freshness belongs
  in the index.
- Sources with `status: superseded` or `status: archived` should not appear to
  drive current-state summaries.
- Changed active sources should be visible in the incremental compile scope.

### Check 4: Hot-Set Integrity

Validate the L1 hot set in `AGENTS.md`:

- Every Details path exists.
- Hot-set summaries agree with the corresponding `wiki/INDEX.md` row where the
  same entity appears.
- Hot-set claims with dates or counts are not older than known newer active L3
  evidence without a warning.

L1 is a convenience cache. If L3 appears newer, report that L1 should be treated
as stale until compile catches up.

### Check 5: Public-Surface Privacy Lint

Scan only public files. Useful signals:

- Literal `private/` path references in public files.
- Medical chart-level detail, financial account/balance detail, or people
  observations in public sources/wiki/outputs.
- Eval fixtures or reports that contain raw sensitive user questions.

Report sensitively. Do not quote large or sensitive snippets; cite the file and
summarize the category. If a finding itself would leak private content, say that
a public file appears to contain restricted content and identify only the file.

### Check 6: Open Queue Visibility

Inspect active `sources/tasks/*.md` and `sources/followups/*.md`:

- Tasks should represent user-committed actions, not loose awareness items.
- Follow-ups should not be surfaced as urgent tasks.
- Open tasks/follow-ups that affect a wiki page should either be reflected in L2
  or reported as uncached work.

### Check 7: Harness And Plugin Drift

Look for mismatches across harness entrypoints and installed plugin source:

- `AGENTS.md` vs `CLAUDE.md`/`GEMINI.md` when present.
- References to renamed plugins or stale skill names.
- Local notes/follow-ups about stale plugin caches.
- Plugin source paths that contradict installed cache paths.

Do not edit downstream plugin caches. Report source-of-truth drift and the
canonical source path.

### Check 8: Source Frontmatter

All Markdown sources should have frontmatter with at least `date`. Report
missing, malformed, future-dated, or contradictory frontmatter. Domain JSON data
does not need Markdown frontmatter, but it should be documented by the owning
skill or a source note if compiled knowledge depends on it.

### Check 9: Domain Store Consistency

When a skill owns structured `data/`, compare compiled wiki claims against the
documented canonical data path. If L2 points at an old source path while a skill
uses `data/<name>.json`, report domain-store drift.

## Golden-query eval design

When asked for `eval`, assess or draft local fixtures. Do not capture real user
queries automatically.

Fixture fields should be deterministic:

```yaml
id: Q001
question: "What is the latest rowing YTD total?"
expected_layer: L3
failure_mode: freshness
required_evidence_paths:
  - sources/notes/YYYY-MM-DD-rowing-report.md
forbidden_paths:
  - private/
required_answer_atoms:
  - "287,875"
forbidden_answer_atoms:
  - "282,875"
freshness_date: 2026-05-04
abstain_required: false
```

Suggested labels:

- Layers: `L1`, `L2`, `L3`, `domain`, `private`, `abstain`.
- Failure modes: `freshness`, `provenance`, `privacy`, `routing`,
  `task-state`, `integrity`.

Score mechanically:

- Expected evidence paths found/read.
- Forbidden paths never touched.
- Required answer atoms present.
- Forbidden stale/private atoms absent.
- Freshness date satisfied when applicable.
- Abstain questions do not guess.

Use public memory benchmarks only as taxonomies. Local qrels decide whether this
Memento is working.

## Output format

Lead with findings, ordered by severity:

- **P0** privacy boundary violation or forbidden-path read/write.
- **P1** broken evidence, stale authority, or compile metadata drift that can
  cause wrong answers.
- **P2** integrity gaps, open-queue visibility gaps, harness drift.
- **P3** cleanup, documentation, or optional eval coverage.

For each finding include:

- Severity and short title.
- File path and line when available.
- Evidence summary.
- Suggested next action.

End with a short "Recommended next step" section. Do not perform the repair
unless the user explicitly asks for implementation.
