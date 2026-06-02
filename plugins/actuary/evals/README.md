# actuary evals — behavioral eval (promptfoo)

The first promptfoo eval in toolshed, and the **template the promotion model
copies**. Where `eval-score` (memento) checks *retrieval* mechanically, this
checks *behavior*: does a skill fire when — and only when — a request calls for
it (trigger-rate), and does it produce the intended outcome.

## The pattern (copy this for any promotable skill)

```
plugins/<plugin>/evals/
├── promptfooconfig.yaml      # providers + test cases + assertions
├── fixtures/
│   ├── .claude/skills/<skill> → symlink to ../../../../skills/<skill>   # the REAL skill, no copy/drift
│   └── <synthetic-target>/    # synthetic inputs the skill operates on (generic placeholders only)
└── README.md
```

- **Test the real skill via a symlink**, never a copy — a copy drifts from the
  source it is supposed to certify.
- **Fixtures are synthetic.** This is a public repo: audit targets, sample data,
  and prompts use generic placeholders only — never real IDs, paths, or
  customer data. `scripts/privacy-scan` gates them at the pre-push hook.
- **One eval per behaviorally-testable skill.** Self-contained skills (like
  `skill-audit`) are clean; env-coupled skills (a Memento root, the org, live
  MCP) need a built fixture first, so they come later.

## Run it

Needs an Anthropic API key and the Claude Agent SDK; **spends tokens per run**.

```bash
cd plugins/actuary/evals
ANTHROPIC_API_KEY=sk-... npx --yes promptfoo@latest eval --repeat 3 --no-cache
npx --yes promptfoo@latest view     # browse results in the web UI
```

`--repeat 3` samples nondeterminism (the "average 2–3 runs" calibration);
`--no-cache` is for active development. promptfoo wants **Node ≥22** (it warns
on Node 20, EOL); bump via fnm before a real run.

## What this eval asserts

- **`skill-used: skill-audit`** on real audit-intent prompts (explicit, casual,
  promotion-readiness phrasings) — the trigger-rate signal.
- **`not-skill-used`** on adjacent intents (skill *creation*, unrelated requests)
  — false-trigger protection. `promptfoo validate` accepts it as a recognized
  type; confirm its runtime negation semantics on the first real run.
- **`llm-rubric`** outcome spot-check: a real audit of the synthetic target names
  its planted weakness (a thin, trigger-less description).
- **`cost` / `latency`** reported as advisory signals on every case.

## Advisory now, gate later

This is **advisory and local** — it informs skill-description tuning and is the
substrate for the Phase-5 A/B "which version wins on held-out tasks" loop. It
does **not** block anything. The blocking, marketplace-tier behavioral gate
(Gate-2) is sequenced separately and only blocks behind κ>0.6-calibrated judges
— blast radius of an advisory local eval ≈ 0; a blocking judge is what the
calibration discipline is for.

Rationale + adoption decision: notes `wiki/topics/harness-deltas.md` (promptfoo
→ ADOPT, 2026-06-02).
