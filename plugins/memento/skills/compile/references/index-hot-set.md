# Index, connection graph, and hot set

Read this reference before Steps 5.6–7. It defines graph failure behavior,
INDEX metadata, the incremental orchestration sequence, and safe hot-set
rendering.

## Contents

- [Step 5.6: Connection graph](#step-56-connection-graph)
- [Step 6: INDEX.md](#step-6-indexmd)
- [Incremental orchestration](#incremental-orchestration)
- [Step 7: AGENTS.md hot set](#step-7-agentsmd-hot-set)

## Step 5.6: Connection graph

After evidence reconciliation, recompute reverse edges and per-page in-degree
from current `[[wikilinks]]` and `related:` fields. The helper writes nothing:

```bash
node ../_shared/scripts/build-graph --root "$MEMENTO_ROOT" --json \
  > /tmp/memento-graph.$$.json
```

This step is fail-open because the graph protects no hard invariant. On nonzero
exit, warn, omit rediscovery in Step 7, and continue compiling and committing.
See `../_shared/references/connection-graph.md` for edge, staleness, and query
semantics.

## Step 6: INDEX.md

Catalog every wiki page by entity type using `templates.md`. Per-type columns
come from registry frontmatter plus Summary, Last Updated, and Pinned.

Preserve manual `pinned` entries and the `rediscovery_recent` rotation cursor.
Add new pages but never auto-pin them. INDEX is the only compile-metadata
surface. On each successful compile update:

- `last_compiled` to today's date
- `last_compile_commit` to the compile-start `COMPILE_BASE_SHA` (omit only for
  non-Git roots)
- each page row's `Last Updated`

The start SHA accurately describes the synthesized tree even if Step 8 has no
commit. Never append `<!-- Compile run ... -->` comments; the local commit is
the durable run record.

## Incremental orchestration

1. Resolve the change set from the start SHA and INDEX baseline; stop current
   when empty.
2. Read changed sources in one batch, using `touches` where present.
3. Build affected entities, then read affected pages in one batch.
4. Batch Class-A edits and concurrently dispatch at least three Class-B pages;
   wait for every page writer.
5. Reconcile evidence, build the graph fail-open, and write INDEX while
   preserving `pinned` and `rediscovery_recent`.
6. Rebuild the AGENTS hot set, optionally render rediscovery, advance the cursor,
   and write AGENTS.md.
7. Run the eval gate. Restore on fail/error; otherwise commit only `wiki/`,
   `AGENTS.md`, and `sources/eval/runs/`. Clean the snapshot after restore,
   successful commit, or an expected skip.

Keep accumulated content and omit compile-run HTML comments. Target 5–6
orchestrator roundtrips: scope, source read, page read, page writes, index/hot
set, gate/commit. Concurrent Class-B generation makes wall time track the
slowest page rather than their sum.

## Step 7: AGENTS.md hot set

Rebuild only the dynamic hot set in canonical `AGENTS.md`; `CLAUDE.md` remains
a thin harness entrypoint and never receives a duplicate.

1. From INDEX read pages, `Last Updated`, `pinned`, and `rediscovery_recent`.
2. Find `<!-- HOT SET START -->` and `<!-- HOT SET END -->` in AGENTS.md.
3. Include every pinned page, then fill by descending Last Updated. Cap at five
   rows per entity type and about 20 rows total.
4. Render name, one-line summary, and wiki link using `templates.md`; replace
   only content between markers.
5. If the Step 5.6 graph succeeded, compute rediscovery:

   ```bash
   node ../_shared/scripts/build-graph --root "$MEMENTO_ROOT" --rediscover \
     --exclude "$EXCLUDE" --cold-days 60 --k 2 --json
   ```

   `$EXCLUDE` is pinned slugs plus recency-hot-set slugs plus
   `rediscovery_recent`. Render at most two picks and at most one per type,
   between balanced `<!-- REDISCOVERY START/END -->` markers nested inside the
   hot set. Each row contains name, why surfaced, and wiki path.
6. Rediscovery is additive headroom: it never consumes the per-type or total
   hot-set budget. If the graph failed, there are no picks, or markers would be
   unbalanced, omit the entire block.
7. Prepend selected slugs to INDEX `rediscovery_recent` with one targeted Edit;
   keep a FIFO depth of four.

If HOT SET markers are missing, append a balanced pair to AGENTS.md, then render
inside it. Never modify text outside those markers. Regenerate the hot set and
optional nested rediscovery block as a unit. An unbalanced rediscovery pair is
not certifiable by Gate-0, so omit it rather than emitting malformed state.
