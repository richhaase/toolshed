# memento — Personal Memory Base Plugin

A multi-layer cache memory base with automated compilation from sources to
wiki to canonical `AGENTS.md` context.

The plugin can be installed globally. Its skills resolve the Memento data root before
reading or writing, so the wiki can live in one configured directory while the
skills are invoked from any project.

## Cache model

The Memento treats knowledge like a CPU cache hierarchy:

- **L1 — `AGENTS.md`** (always resident where supported): Hot set tables with
  pointers to wiki pages. `CLAUDE.md` is a thin harness entrypoint that
  points to the same canonical context. Maintained automatically by
  `/compile`.
- **L2 — Wiki** (loaded on demand): Compiled topic pages. Read when L1 doesn't have enough detail.
- **L3 — Sources** (cold storage): Raw ingestion — session captures, automated syncs, manual notes. Accessed when L2 doesn't resolve the question.
- **Outputs** (outside hierarchy): Products of the system — surfaces (HTML dashboards) and reports.

Compilation flows upward: L3 -> L2 -> L1. The `/compile` skill handles the full pipeline.

## Quick start

```
/memento-config
```

On a fresh directory, this scaffolds the structure and walks you through
customizing entity types, profile, and nicknames. On an existing Memento,
it detects current state and offers a targeted update branch (add an entity
type, modify an entity type, update profile, update nicknames).

## Memento root configuration

Skills resolve the Memento root in this order:

1. `MEMENTO_ROOT` environment variable
2. nearest `.memento-root` file walking upward from the current directory
3. current directory, if it already looks like a Memento

For a global Memento, either export `MEMENTO_ROOT`:

```bash
export MEMENTO_ROOT=~/src/memento
```

Or add a `.memento-root` file to a project:

```text
/path/to/your/memento
```

Bundled scripts:

- `skills/_shared/scripts/memento-root` prints the resolved Memento root.
- `skills/_shared/scripts/memento-run <command>` runs a command from the resolved Memento root.
- `skills/_shared/scripts/eval-score` (node) — the deterministic golden-query scorer behind the eval gate. `compile` runs it before committing; `health-check eval` runs it read-only on demand. Emits the verdict contract; `--self-test` proves it fails a poisoned hot set.

## Directory structure

```
sources/                # L3 — raw inputs
├── sessions/           # /save captures from conversations
├── syncs/              # Automated pulls (one subdir per provider)
│   └── <provider>/     # e.g., concept2/, github/
├── notes/              # Durable knowledge — folds into wiki on /compile
├── followups/          # Small queue of "re-read within a week, act on it" items
├── trajectories/       # <date>/<run-id>.md — structured per-session telemetry (local-only, never promoted)
└── eval/               # Golden-query eval — NOT compiled (gate data + telemetry)
    ├── fixtures/       #   regression.json (must stay 100%) + capability.json (threshold)
    ├── verdict-contract.json  #   thresholds + the frozen verdict shape
    └── runs/           #   <date>.jsonl — every gate verdict (retrieval integrity, measured)
wiki/                   # L2 — compiled knowledge
├── INDEX.md            # Master index with freshness + pinned status
└── <entity-type>/      # Subdirs per entity type
outputs/                # Products
├── surfaces/           # HTML dashboards, served over HTTP
└── reports/            # Generated briefings, analyses
private/                # Sensitive notes — never compiled
```

## Where things go

The Memento is a knowledge base, not a task tracker. Real commitments
(things you are driving to done) belong in your issue tracker — Jira,
Linear, GitHub issues — not in markdown here. `/save` does not write
`sources/tasks/`; the directory is intentionally absent.

What `/save` does write:

- **Durable knowledge → `sources/notes/`.** Facts, clarifications,
  patterns, lessons. `/compile` folds these into `wiki/`.
- **Decisions and research → `sources/sessions/`.** Dated session captures.
- **Analyses → `outputs/reports/`.** Substantive trade-off evaluations.
- **Sensitive observations → `private/`.** Per the Entity Types registry.
- **Follow-ups → `sources/followups/`, at most one per session,
  user-confirmed.** A follow-up only earns its place if you would re-read
  it within a week and act on it. Each one carries an `expires_at`
  frontmatter field (default: date + 14 days) so the queue self-cleans.
- **Trajectory → `sources/trajectories/<date>/<run-id>.md`, one per
  substantive session.** Structured telemetry (task, outcome, skills/tools
  used, artifacts, Reflexion lessons) — the substrate the learning loop reads.
  Local-only forever; never promoted.

Follow-ups are reviewed via `/followups` — `list` (default) prints the
inventory expired-first, `show <slug>` renders one item read-only, and
`walk` triages one at a time (`keep` with optional expiry bump,
`dismiss`, `answer`, `note`, or `file-and-dismiss` when something turns
out to be a real commitment that belongs in the issue tracker).

## Health and eval discipline

L1 and L2 are generated projections over L3 sources, not authority. Use
`health-check` before adding retrieval machinery: it audits cache freshness,
broken evidence paths, compile metadata drift, public-surface privacy risks,
open queue visibility, and eval readiness without reading `private/` or writing
repairs.

### The eval gate (Gate-0) — gated, not trusted

`compile` rewrites the always-resident `AGENTS.md` hot set on every run. To keep a bad
compile from silently dropping a load-bearing fact into the surface every future session
loads, `compile` runs a **deterministic eval gate (Step 7.5)** between the hot-set rewrite
and the commit:

- **Fixtures** are committed golden queries under `sources/eval/fixtures/`
  (`regression.json` — must stay 100%; `capability.json` — threshold). Each names
  source `required_evidence_paths` for provenance and optional compiled
  `answer_surface_paths` / `compiled_evidence_paths` (`AGENTS.md`, `CLAUDE.md`,
  or `wiki/...`) for where the compiled answer should be found. Anchor them to
  **human-asserted ground truth**, not to the wiki they police — where they
  disagree, the wiki is what's wrong (authoring the fixtures doubles as a
  staleness audit).
- **`eval-score`** (node, `_shared/scripts/`) checks mechanically — no LLM judge — that
  every required atom is still present in the freshly-compiled answer surface
  (`AGENTS.md` plus named wiki pages). Raw `sources/...` evidence proves provenance
  but does not satisfy answer atoms. It emits the verdict contract and logs it to
  `sources/eval/runs/<date>.jsonl` during compile.
- **On `verdict: fail`** (a regression dropped) **or a scorer that can't run**, `compile`
  **rolls back** `AGENTS.md` + `wiki/` to the pre-compile SHA and does not commit
  (fail-closed), emitting a defect follow-up. `MEMENTO_EVAL_GATE=warn` downgrades to
  warn-only; default is `enforce`.
- **On `verdict: ungated`** (no scored regression fixtures), `compile` warns and
  commits. The Memento remains usable, but Gate-0 did not protect the run.

`health-check eval` runs the same scorer on demand. The forbidden-atom / abstain checks in
the fixtures are answer-level — verifiable only by an LLM-answering eval, not the static
gate. Public memory benchmarks can inform the taxonomy, but local questions decide whether
this Memento is working.

### Promotion (gated, human-triggered)

A local experiment graduates outward through `promote`:
`experiment -> marketplace-ready -> marketplace` (or `retired`). A promote
flow always targets a marketplace git repo. The default target is `memento`,
the active Memento/RSI target; toolshed is one other marketplace target, not a
separate lifecycle stage. Promotion state lives as **data**:
`promotion_stage` frontmatter on `wiki/skills/` + `wiki/tools/` pages plus an
append-only `wiki/skills/_promotion-ledger.md`, so "what is ready" and "what
duplicates capability" are grep queries, not folklore.

- **`promote` is the sole writer** of the ledger and the stage frontmatter.
  Hand-edited stage values desync the ledger from the pages — `health-check`
  flags a stage with no backing ledger entry as a contradiction.
- **Gate-1** is `actuary --tier <tier>` (invoked through harness-native skill
  composition when available, or by applying the Actuary skill workflow directly):
  a privacy/genericization scan + L1 spec check turned into a readiness verdict.
  Privacy is a non-negotiable marketplace hard-block.
- **Gate-2** (promptfoo behavioral CI) is a later phase; `promote` reports it as
  unproven rather than synthesizing a pass.
- The deterministic backstop is `scripts/privacy-scan` (toolshed repo infra,
  fail-closed) at the pre-push hook — real IDs/paths/keys never reach the public
  repo even if Gate-1 is skipped.

Promotion is **human-triggered**: `promote` writes nothing until you confirm the
stage change.

## Skills

| Skill | Description |
|-------|-------------|
| `memento-config` | Idempotent setup-and-update surface — scaffolds new Mementos, offers a targeted update branch on existing ones |
| `compile` | Full pipeline: L3 -> L2 (sources -> wiki) then L2 -> L1 (wiki -> `AGENTS.md` hot set), with a deterministic eval gate + auto-rollback (Step 7.5) protecting the hot set before commit |
| `health-check` | Read-only doctor for stale projections, broken evidence paths, privacy lint, compile metadata drift, golden-query eval readiness, and promotion-ledger integrity; `eval` runs the deterministic scorer (`eval-score`) against the committed fixtures |
| `save` | Passive end-of-session capture — extract decisions, research, durable knowledge, analyses, private notes, (at most one, confirmed) follow-up, and a structured trajectory record per substantive session |
| `ama` | Active LLM-driven interview — read the wiki, ask the user to fill gaps, capture answers as a session source |
| `followups` | Review open follow-ups: `list` (default, expired-first) prints the inventory, `show <slug>` renders one item read-only, `walk` triages one at a time (keep, dismiss, answer, note, file-and-dismiss) |
| `promote` | Gated promotion of a local skill/tool to a marketplace git repo, defaulting to the active Memento/RSI target; composes `actuary --tier` (Gate-1: privacy + spec) through the harness's skill-composition surface when available, presents one decision, and is the **sole writer** of the promotion ledger + `promotion_stage` frontmatter |

For lookup, follow the L1 -> L2 -> L3 hierarchy directly (start at `AGENTS.md`,
descend into `wiki/` and `sources/` as needed). For passive capture, edit
files under `sources/` directly or use `/save` at session end. For active
capture, run `/ama` to let the agent interview you on what's missing.
Supersession is a manual frontmatter edit (see Source status below).

## Source status

Sources are current by default. Add frontmatter when a source should stop
shaping current synthesis:

```yaml
---
status: active|superseded|archived
supersedes:
  - sources/path-to-old-source.md
superseded_by: sources/path-to-new-source.md
archive_note: "Why this is historical only"
correction_note: "What changed and why"
---
```

`compile` ignores `superseded` and `archived` sources for current-state wiki
and hot-set synthesis.

## Design principles

- **Multi-layer cache.** L1 (`AGENTS.md`) -> L2 (wiki) -> L3 (sources). Progressive disclosure.
- **Convention over configuration.** File existence = open task. Frontmatter = metadata. Directories = organization.
- **Local-first.** Git repo, no remote required.
- **Additive.** Wiki compilation never destroys historical content.
- **Gated, not trusted.** `compile` auto-rolls-back if the eval gate finds a load-bearing fact dropped from the hot set — the privileged surface is never committed unverified.
- **Private by default.** `private/` is never compiled or referenced externally.
- **Opinionated defaults, customizable.** Works immediately; `memento-config` interview tunes it on first run, and updates it on subsequent runs.

## File conventions

- All content is Markdown with YAML frontmatter
- Filenames: lowercase, hyphens, no spaces
- Session captures: `YYYY-MM-DDTHHmmss-topic.md`
- Sync data: `YYYY-MM-DDTHH-mm-ss.md` (in provider subdir)
- Notes: `YYYY-MM-DD-topic.md`
- Follow-ups: `topic-slug.md` (date and `expires_at` in frontmatter)
- Required frontmatter: `title`, `date`

## License

MIT
