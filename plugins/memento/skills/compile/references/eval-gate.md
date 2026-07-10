# Eval gate and rollback

Read this reference before Step 7.5. It is the fail-closed Gate-0 contract that
protects the compiled answer surface before Step 8 commits it.

## Contents

- [Purpose and scorer](#purpose-and-scorer)
- [Gate decision](#gate-decision)
- [Recovery and self-test](#recovery-and-self-test)

## Purpose and scorer

Gate-0 checks committed golden-query fixtures against the freshly compiled
`AGENTS.md` hot set and named wiki answer pages. It is mechanical,
deterministic, Node-based, and uses no LLM judge. With no scored regression
fixtures the verdict is `ungated`: commit may proceed, but report that the run
was not protected.

From the compile skill directory, run:

```bash
node ../_shared/scripts/eval-score --root "$MEMENTO_ROOT" --gate --json \
  > /tmp/memento-eval.$$.json
rc=$?
```

Step -1 has already checked Node because neither Claude Code nor Codex
guarantees it. The scorer reads:

- `sources/eval/fixtures/{regression,capability}.json`
- `sources/eval/verdict-contract.json`

It validates every `required_evidence_path` and checks each
`required_answer_atom` against compiled answer surfaces: `AGENTS.md`, explicit
`answer_surface_paths` / `compiled_evidence_paths`, and legacy `wiki/...`
entries under `required_evidence_paths`. Raw `sources/...` paths prove
provenance but never satisfy answer atoms. Answer surfaces must be `AGENTS.md`,
`CLAUDE.md`, or `wiki/...`.

The scorer appends telemetry to `sources/eval/runs/<today>.jsonl` and exits:

- `0`: pass, advisory, or ungated
- `1`: fail because regression is below 100%
- `2`: error or unavailable

## Gate decision

`MEMENTO_EVAL_GATE` defaults to `enforce`:

- `rc == 0`, `verdict: pass`: proceed to Step 8.
- `rc == 0`, `verdict: advisory`: warn, then commit. Capability is a threshold
  suite, so a dip does not justify reverting when regression remains 100%.
- `rc == 0`, `verdict: ungated`: warn, then commit; suggest drafting fixtures
  through `health-check fixtures`.
- `rc >= 1`, either `fail` or scorer error: restore and do not commit:

  ```bash
  ../_shared/scripts/compile-output-guard restore --snapshot "$COMPILE_SNAPSHOT"
  ../_shared/scripts/compile-output-guard cleanup --snapshot "$COMPILE_SNAPSHOT"
  ```

The Step -1 snapshot restores `AGENTS.md` and `wiki/` to their exact pre-run
state even outside Git. Fail closed: an unavailable scorer is not a clean bill
of health. On `fail`, the scorer also writes
`sources/followups/compile-eval-fail-<today>.md` naming failed fixtures. Report
the rollback and failures; never retry silently.

`MEMENTO_EVAL_GATE=warn` is only for landing the gate or debugging a fixture.
It downgrades `fail` to warn-and-commit while retaining the verdict and
follow-up. `enforce` remains the default.

## Recovery and self-test

Run this if scorer behavior is suspect:

```bash
node ../_shared/scripts/eval-score --self-test
```

It proves a deliberately poisoned hot set fails and raw source evidence cannot
satisfy a compiled answer atom.

For manual recovery outside a compile:

First require the target paths to be clean, or snapshot them and obtain explicit
confirmation; manual recovery must not overwrite unrelated uncommitted edits.

- `compile rollback hot-set`: use the last `verdict: pass` run entry to find the
  last green SHA, then `git checkout <sha> -- AGENTS.md`.
- `compile rollback compile`: revert the latest compile commit's `AGENTS.md` and
  `wiki/` changes with `git revert <sha>` or
  `git checkout <prev> -- AGENTS.md wiki/`.

These named operations are ordinary local Git recovery; they add no service or
storage layer.
