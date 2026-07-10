# Source selection and entity discovery

Read this reference before Steps 1–3. It defines source lifecycle metadata,
incremental change detection, batched gathering, and the affected-entity graph.

## Contents

- [Source status metadata](#source-status-metadata)
- [Step 1: Determine scope](#step-1-determine-scope)
- [Step 2: Gather sources](#step-2-gather-sources)
- [Step 3: Build the affected-entity graph](#step-3-build-the-affected-entity-graph)

## Source status metadata

Memento sources may include YAML frontmatter:

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

- `active` is the default.
- `superseded` means a newer source replaces this source for synthesis.
- `archived` means preserve for history, but do not use for current synthesis.
- `supersedes` and `superseded_by` may be a scalar or list; normalize them as
  source-relative paths when checking traceability.

## Step 1: Determine scope

Run `date '+%Y-%m-%d'` to get today's date. Capture the HEAD SHA observed at
compile-start; Step 6 records this as the baseline for the next incremental:

```bash
COMPILE_BASE_SHA="$(git -C "$MEMENTO_ROOT" rev-parse HEAD 2>/dev/null || echo "")"
```

If `wiki/INDEX.md` does not exist, run a full build regardless of arguments.
Otherwise determine the change set below.

### Git-backed incremental detection

When `COMPILE_BASE_SHA` is non-empty, use Git as the source of truth. Read
`last_compile_commit` from INDEX.md frontmatter:

- Missing, empty, or not a 40-character hex SHA: full build, then backfill it.
- `git cat-file -e <sha>^{commit}` fails: full build and report that the
  baseline is stale, rebased away, or absent from a shallow clone.
- Otherwise use the union of these three `sources/` queries:

```bash
# Committed changes since baseline (rename-aware, drops deletes).
git -C "$MEMENTO_ROOT" diff --name-only --diff-filter=AMR -M \
  "$last_compile_commit"..HEAD -- sources/
# Unstaged working-tree changes.
git -C "$MEMENTO_ROOT" diff --name-only HEAD -- sources/
# Untracked files honoring .gitignore.
git -C "$MEMENTO_ROOT" ls-files --others --exclude-standard sources/
```

Guard each read path with `[ -f "$path" ]`; rename-old paths and deletes must
be skipped rather than passed to a Read call.

### Non-Git incremental detection

When `COMPILE_BASE_SHA` is empty, retain mtime detection for scratch and
non-Git Mementos. Search all of `sources/`; a fixed directory list silently
misses new top-level source directories. Exclude eval and trajectory telemetry:

```bash
../_shared/scripts/memento-run find sources -name '*.md' -newer wiki/INDEX.md \
  -not -path 'sources/eval/*' -not -path 'sources/trajectories/*' 2>/dev/null
```

After reading changed files through either path, discard sources whose status
is `superseded` or `archived`. If no active sources remain, report
"wiki is current — no active source changes since last compile", clean up
`COMPILE_SNAPSHOT`, and stop.

## Step 2: Gather sources

### Incremental updates

1. Use Step 1's change set, excluding `sources/eval/` and
   `sources/trajectories/`; neither is knowledge to synthesize.
2. In one message, issue parallel Read calls for every existing changed source
   and `wiki/INDEX.md`.
3. Run Step 3 to identify affected entities, honoring `touches` frontmatter.
4. In one message, issue parallel Read calls for every affected wiki page that
   needs updating.

### Full builds

Glob all source directories, excluding `sources/eval/` and
`sources/trajectories/`. Parse frontmatter first, compile only active sources,
and retain the skipped superseded/archived list for the final report.

Do not accumulate an unbounded corpus in the orchestrator. Read bounded batches
of about 20 sources and reduce each batch to the affected-entity map plus compact
evidence excerpts. When background agents are available, have batch workers
return that bounded intermediate representation; merge the maps, not every raw
body, before Step 4. For a large single entity/type, partition again by entity
or source batch rather than creating one oversized worker prompt.

## Step 3: Build the affected-entity graph

Extract mentions from gathered source content and classify them using the
Entity Types registry:

`entity type -> entity name -> [source files that mention it]`

Detect untracked entities as well. A topic or name appearing at least three
times across sources likely deserves a page; assign it to the closest entity
type.

### `touches` short-circuit

When frontmatter declares `touches: [entity-name, ...]`, treat it as that
source's canonical affected set and skip scanning its body. This is a one-way
read: compile consumes the field but never writes or requires it, modifies a
writer to produce it, or special-cases a source name. Sources without it use
mention extraction.

### `<provider>_users` enrichment maps

Sources may declare `<provider>_users: { Full Name: <stable-id> }`, such as
`slack_users`, `github_users`, or `linear_users`. Each entry provides a stable
provider identifier for a named person. Step 4 uses these maps to enrich
`wiki/people/*.md` frontmatter.

This too is a one-way, provider-generic read. Compile never writes the map back,
never requires it, and never special-cases a provider. Sources without a map
are unaffected.
