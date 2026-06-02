---
name: promote
description: >
  Promote a skill or tool one stage along the local -> toolshed -> marketplace
  lifecycle, gated on a privacy + spec verdict and a single human decision. Use
  when the user says "promote", "graduate this skill", "is X ready to promote",
  "advance the promotion stage", "promote to toolshed", or "promote to
  marketplace". Composes actuary --tier (Gate-1: privacy/genericization + spec)
  via the Skill tool, surfaces capability duplication, and on your explicit OK
  performs the promotion mechanics. This skill is the SOLE WRITER of the
  promotion ledger and the promotion_stage frontmatter — never hand-edit those.
argument-hint: "<skill-or-tool> [--to <local-ok|toolshed-ready|toolshed|marketplace-ready|marketplace>] [--dry-run]"
user-invocable: true
allowed-tools: Read Glob Grep Bash Edit Write Skill
---

# Promote

Move one skill or tool one stage along the promotion lifecycle, as an owned
function: `experiment -> local-ok -> toolshed-ready -> toolshed ->
marketplace-ready -> marketplace` (or `retired`). Promotion is **gated, not
trusted** and **human-triggered** — this skill never auto-fires a promotion. It
composes the gates, presents one decision, and only on your OK writes the ledger
and performs the mechanics.

## Memento root

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
```

See `../_shared/references/memento-root.md` for the resolution contract. The
ledger (`wiki/skills/_promotion-ledger.md`) and the `promotion_stage`
frontmatter on `wiki/skills/` + `wiki/tools/` pages are all relative to
`MEMENTO_ROOT`.

## Gotchas

- **This skill is the sole writer of promotion state.** Only `promote` writes
  `promotion_stage`/`promotion_blockers`/`dedup_of`/`last_eval_pass` frontmatter
  and appends to `_promotion-ledger.md`. Hand edits desync the ledger from the
  pages — `health-check` flags a stage value with no backing ledger entry as a
  contradiction. If you find a mismatch, reconcile it through `promote`, don't
  patch the frontmatter.
- **The ledger is the authority.** If a page's `promotion_stage` disagrees with
  the ledger's latest entry for that entity, STOP and report — do not promote on
  top of an inconsistent base.
- **Privacy is a non-negotiable hard-block above `local`.** Any `privacy-*`
  finding from actuary blocks a `toolshed`/`marketplace` promotion. There is no
  advisory-override for privacy. The deterministic `scripts/privacy-scan` at the
  toolshed pre-push hook is the backstop, but catch it here first.
- **Promotion is human-triggered.** Always confirm the actual stage change with
  the user (Step 5) before writing anything. `--dry-run` stops after the verdict.
- **Compose other skills via the Skill tool — never reach into their files.**
  Invoke `actuary` via the Skill tool for the tier verdict. Use this plugin's
  own `_shared` scripts and `scripts/privacy-scan` (toolshed repo infra) by name.
- **Toolshed pushes go to main directly; never edit plugin caches.** Edit source
  in the toolshed repo, bump `plugin.json` (both manifests), push to main.
  Marketplace promotions target a separate repo and stay a documented,
  human-driven tail (Step 6).

## Arguments

`$ARGUMENTS`:

- `<skill-or-tool>` (required) — a `wiki/skills/` or `wiki/tools/` slug, an
  entity name, or a path to a local skill directory containing `SKILL.md`.
- `--to <stage>` (optional) — target stage. Default: the next stage up from the
  entity's current stage.
- `--dry-run` (optional) — run the gates and print the verdict + proposed
  change, then stop. Writes nothing, asks nothing.

## Step 1: Resolve the entity and its current stage

1. Resolve the target to a `wiki/skills/<slug>.md` or `wiki/tools/<slug>.md`
   page (and, when promoting outward, its source files — a local
   `.claude/skills/<name>/` or the toolshed `plugins/<plugin>/skills/<name>/`).
2. Read the page frontmatter: `promotion_stage`, `promotion_blockers`,
   `dedup_of`, `last_eval_pass`.
3. Read `wiki/skills/_promotion-ledger.md` and find the latest dated entry for
   this entity.
4. **Consistency gate.** If the page `promotion_stage` and the ledger's latest
   entry disagree, STOP: report the mismatch and that the ledger is authority.
   Do not proceed until reconciled (through this skill).
5. Determine the target stage (`--to` or next-up). If the entity is already at
   or above the target, report and stop.

## Step 2: Gate-1 — actuary tier verdict (privacy + spec)

Invoke `actuary` via the **Skill tool** with `--tier <target-tier-class>`
against the entity's **source files** (the local/toolshed skill directory, not
just the wiki page). Map the target stage to the tier class actuary understands:

- `local-ok` -> `local`
- `toolshed-ready` / `toolshed` -> `toolshed`
- `marketplace-ready` / `marketplace` -> `marketplace`

Read back the tier verdict: `verdict: ready|not-ready`, the privacy findings
(by `privacy-*` rule key, masked), and the L1 spec result. Privacy hard-blocks
above `local`; L1 must be clean for `toolshed`+.

## Step 3: Gate-2 — behavioral (deferred)

The promptfoo behavioral gate (skill-used + outcome + cost) is Phase 3 and not
yet wired. Treat it as:

- `toolshed`: **advisory** — note it is unproven, do not block on it.
- `marketplace`: **required-but-unproven** — report it as an unmet prerequisite;
  a `marketplace` verdict cannot be `ready` until Phase-3 CI exists and passes.

Never synthesize a behavioral pass.

## Step 4: De-dup (advisory)

Grep `wiki/skills/` + `wiki/tools/` for capability overlap with the target
(similar trigger phrases, same job). Surface overlaps as `dedup_of` candidates
for the user to decide. Never auto-merge or auto-retire on overlap.

## Step 5: Present the decision (and confirm)

Compose a single verdict block:

- entity, current stage -> target stage
- Gate-1 (actuary): `ready|not-ready` + blocking `privacy-*`/L1 keys
- Gate-2 (behavioral): advisory/unproven
- dedup candidates (if any)
- the mechanics the promotion entails (Step 6)

If `--dry-run`, stop here. Otherwise, if any **hard requirement** for the tier is
unmet, STOP — report the blockers; do not offer to promote. Only when the hard
requirements are met, confirm with the user via `AskUserQuestion`:

> "Promote `<entity>` `<from>` -> `<to>`? Gate-1 ready; <gate-2 note>. This will
> <mechanics>. Proceed?"

Promotion is human-triggered: write nothing until the user says yes.

## Step 6: Perform the promotion (only on explicit OK)

Mechanics depend on the target stage:

- **`local-ok`** — no code move; record the stage. (A local experiment judged
  good enough to keep using locally.)
- **`toolshed-ready`** — the function is genericized and gate-clean but not yet
  pushed; record the stage + any residual `promotion_blockers`.
- **`toolshed`** — the function lives in the toolshed repo. If it is not already
  there: edit the toolshed source (synthetic placeholders only — no real IDs,
  paths, or customer data), bump `version` in BOTH `plugin.json` manifests, run
  `node scripts/privacy-scan` from the toolshed root (must exit 0), commit, and
  push to `main`. The pre-push hook re-runs the scan as the backstop.
- **`marketplace-ready` / `marketplace`** — the marketplace is a SEPARATE repo.
  This step stays a documented, human-driven tail: confirm Phase-3 behavioral CI
  is green, then the user drives the marketplace-repo change. `promote` records
  the stage and ledger entry once the user confirms the external move landed.

## Step 7: Write promotion state (sole writer)

After the mechanics land:

1. Update the entity page frontmatter: set `promotion_stage` to the new stage;
   set `last_eval_pass` to today if Gate-1 passed; clear resolved
   `promotion_blockers`; set `dedup_of` if the user accepted a dedup link.
2. Append a dated `## <date> — <entity>: <from> -> <to>` H2 to
   `wiki/skills/_promotion-ledger.md` with: gates run + verdicts, evidence
   (commit SHA / PR for code moves), and any residual blockers. Append-only —
   never rewrite prior entries.
3. Report the change, the ledger entry, and the new stage.

## What this skill does *not* do

- Auto-promote without a human OK.
- Override a privacy hard-block.
- Synthesize a behavioral-gate pass.
- Hand-edit promotion state outside this flow (it is the sole writer).
- Push to the marketplace repo on its own (human-driven tail).
