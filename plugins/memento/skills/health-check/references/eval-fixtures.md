# Eval scorer and fixtures

Read this reference before interpreting an `eval` verdict or drafting fixtures
in `fixtures` mode.

## Contents

- [What the scorer reads](#what-the-scorer-reads)
- [Fixture shape](#fixture-shape)
- [What the gate can and cannot verify](#what-the-gate-can-and-cannot-verify)

## What the scorer reads

`eval-score` (node, `_shared/scripts/`) reads
`sources/eval/fixtures/{regression,capability}.json` and
`verdict-contract.json`, validates that `required_evidence_paths` exist, and checks each
fixture's `required_answer_atoms` against the compiled answer surface (`AGENTS.md` plus
explicit `answer_surface_paths` / `compiled_evidence_paths`, with legacy `wiki/...`
evidence paths included). Answer-surface paths must be compiled surfaces
(`AGENTS.md`, `CLAUDE.md`, or `wiki/...`). Raw `sources/...` evidence proves
provenance but does not satisfy answer atoms. Compile runs the same scorer at Step 7.5 with logging enabled (default
`enforce` — auto-rollback on a regression fail). If no regression fixture is scored, the
verdict is **`ungated`**.

## Fixture shape

Fixtures are stored as JSON (node-native; the scorer is dependency-free):

```json
{
  "id": "Q001",
  "question": "What is the latest rowing YTD total?",
  "expected_layer": "L3",
  "failure_mode": "freshness",
  "required_evidence_paths": ["sources/notes/YYYY-MM-DD-rowing-report.md"],
  "answer_surface_paths": ["wiki/topics/rowing.md"],
  "forbidden_paths": ["private/"],
  "required_answer_atoms": ["287,875"],
  "forbidden_answer_atoms": ["282,875"],
  "freshness_date": "2026-05-04",
  "abstain_required": false
}
```

Suggested labels:

- Layers: `L1`, `L2`, `L3`, `domain`, `private`, `abstain`.
- Failure modes: `freshness`, `provenance`, `privacy`, `routing`, `task-state`, `integrity`.

## What the gate can and cannot verify

- **Static gate (`eval-score`, every compile):** `required_evidence_paths` exist; every
  `required_answer_atom` present (case-insensitive) in the compiled answer surface —
  `AGENTS.md` plus explicit wiki answer-surface paths. Source paths establish provenance
  only; they cannot satisfy an answer atom.
- **Answer-level (on-demand LLM eval only):** `forbidden_answer_atoms` absent,
  fixture-specific `forbidden_paths` respected, and `abstain` questions don't guess. A
  private path may be valid local context for a query; mark it forbidden only when
  that query specifically must not use it. These checks need an actual answer —
  a corpus substring scan false-positives (the hot set mentions every entity; pages keep old
  values in history). The static gate does not enforce them; they live in the fixtures for the
  answering eval.

Anchor fixtures to **human-asserted ground truth**, not the wiki they police — where they
disagree, the wiki is what's wrong (authoring them doubles as a staleness audit). Public memory
benchmarks inform the taxonomy; local qrels decide whether this Memento is working.
