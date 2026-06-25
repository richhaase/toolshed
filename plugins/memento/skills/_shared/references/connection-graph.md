# Connection graph (`build-graph`)

`_shared/scripts/build-graph` is the Memento's connection-graph substrate: it
recomputes the **current-state** reverse-edge graph and per-page in-degree from the
links `/compile` already maintains, and serves proactive-rediscovery queries over
it. It is **read-only** — it parses `wiki/` (and source frontmatter for dates) and
writes nothing. Node, dependency-free, the same family as `eval-score` and
`reconcile-evidence-refs`; invoke it via `../_shared/scripts/build-graph` from any
skill (the skill resolves its own relative path — never hard-code a plugin-cache
path into `AGENTS.md` or other committed Memento data).

## What counts as an edge (current-state rule)

- A `related:` frontmatter entry → always a current edge.
- A body `[[wikilink]]` → a current edge **unless** it sits under a historical
  section heading, or inside a fenced/inline code span (those are ignored).
- Historical headings are matched by **prefix on the normalized heading** against a
  default denylist — `history, historical, correction, recent activity,
  activity log, changelog, archive, superseded` — unioned with any per-type
  `historical_sections:` declared in the `## Entity Types` registry. `Key Decisions`
  is current.
- Targets resolve to a real wiki page slug (basename); unresolved targets are
  dropped and reported under `unresolved_targets`.

In-degree is the count of distinct pages with a current edge **into** a page. It is
a relevance floor for rediscovery, never the rank — see below.

## Staleness (L3-derived, regenerable)

A page's freshness is `today − max(date)` over its **active, non-projection, dated**
contributing `sources:`. A page with no qualifying dated source is **excluded** from
rediscovery (never treated as "maximally cold"), which is why projection-only pages
(pure provider syncs) don't dominate, and why a superseded page drops out once it
loses its qualifying active sources. Nothing is persisted — staleness is recomputed
each run, so `rm -rf wiki/` and recompile is identical.

## CLI

```
build-graph [--root DIR] [--json]
            [--backlinks SLUG]      # pages with a current edge INTO SLUG
            [--neighbors SLUG]      # inbound + outbound for SLUG
            [--seed SLUG]           # cold pages within graph distance 1–2 of SLUG, staleness desc
            [--coupled SLUG]        # cold pages sharing a qualifying L3 source with SLUG (bibliographic coupling)
            [--rediscover [--exclude a,b,c] [--cold-days N] [--k N]]
            [--self-test]
Exit: 0 ok · 64 usage · 2 runtime error.
```

Default (no query flag) emits the full graph: every page with `in_degree`, `inbound`,
`outbound`, `last_source_date`, `qualifying_sources`, `staleness_days`, `cold`, plus
`unresolved_targets` and `edges_total`.

## Rediscovery selection (`--rediscover`)

A candidate must: have ≥1 active, non-projection, dated source · be cold
(`staleness_days > --cold-days`, default 60) · have `in_degree ≥ 1` (advisory floor —
errs safe: a false-orphan from incomplete cross-linking is silently not surfaced,
never wrongly surfaced) · not be in `--exclude` (compile passes pinned ∪ recency
hot set ∪ `rediscovery_recent`). Survivors rank by **`staleness_days` desc, slug asc**;
take `--k` (default 2), **≤1 per entity type**. Ranking by staleness (not in-degree)
is deliberate — ranking by connectedness would surface the least-forgotten hubs, the
opposite of "knowledge the agent would not think to query."

## How the two goals are served

- **Connection graph (agent traversal):** the only always-resident affordance is the
  coarse `grep -rlF '[[<slug>]]' wiki/` line in the AGENTS.md Lookup Hierarchy. For
  exact, current-state, deduped backlinks/neighbors, a memento skill (or the user)
  runs `build-graph --backlinks`/`--neighbors`. The grep is a superset (it matches
  history sections, superseded pages, and is undeduped) — trust `build-graph` for
  current-state counts.
- **On-demand, task-conditioned rediscovery:** `--seed <page the agent is reading>`
  and `--coupled <slug>` surface cold knowledge connected to the current task with no
  vectors and no always-resident cost.
- **Ambient rediscovery (Phase 2):** `/compile` runs `--rediscover` and renders a
  small additive `### Rediscovery` block inside the hot-set markers. See the compile
  skill.

## Verifying

`build-graph --self-test` builds a fixture Memento and asserts the in-degree,
code-fence exclusion, historical-section exclusion (default + registry), Key-Decisions
inclusion, projection exclusion, staleness, and backlink behavior. A gate you can't
trust to fail is worse than none — run it if you suspect the parser is wrong.
