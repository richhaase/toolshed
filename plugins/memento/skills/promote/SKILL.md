---
name: promote
description: >
  Promote a local skill or tool into a chosen marketplace git repo, gated on a
  static privacy + portable-spec verdict and explicit user confirmation. Use
  when the user asks to promote, graduate, assess readiness, or advance a local
  skill/tool to toolshed or another marketplace. Resolve the target repo first,
  defaulting to the active Memento/RSI target when available. Composes Actuary's
  static Gate-1, surfaces unproven behavioral/dedup evidence, and is the sole
  writer of the promotion ledger and `promotion_stage` frontmatter.
argument-hint: "skill-or-tool [--marketplace repo-path-or-name] [--to marketplace-ready|marketplace] [--dry-run]"
user-invocable: true
allowed-tools: Read Glob Grep Bash Edit Write Skill AskUserQuestion
---

# Promote

Move one skill or tool one stage along the promotion lifecycle, as an owned
function: `experiment -> marketplace-ready -> marketplace` (or `retired`).
A "promote to local" command is meaningless: promotion always targets a
marketplace git repo. The default marketplace target is `memento`, the Memento
RSI target. A marketplace can also be toolshed or another marketplace target;
toolshed is not an intermediate stage. Promotion is **gated, not trusted** and
**human-triggered** — this skill never auto-fires a promotion. It composes the
gates, presents one decision, and only on your OK writes the ledger and performs
the mechanics.

## Memento root

```bash
MEMENTO_ROOT="$(../_shared/scripts/memento-root)"
```

See `../_shared/references/memento-root.md` for the resolution contract. The
ledger (`wiki/skills/_promotion-ledger.md`) and the `promotion_stage`
frontmatter on `wiki/skills/` + `wiki/tools/` pages are all relative to
`MEMENTO_ROOT`.

## Marketplace target

Promotion has two coordinates: the target stage (`marketplace-ready` or
`marketplace`) and the target marketplace git repo. Resolve the repo before any
gate runs.

Resolution order:

1. Use `--marketplace <repo-path-or-name>` when provided.
2. Otherwise default to `memento`, the active Memento/RSI target.
3. If `memento` cannot resolve to a concrete git repo marketplace, ask the user
   for the marketplace repo path or name.

`memento` means the configured Memento root when it is a git repo and is serving
as the RSI marketplace target. `toolshed` means the toolshed repo marketplace.
Named targets must resolve to a real git repo before Gate-1; never run gates
against an unresolved alias.

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
- **Privacy is a non-negotiable marketplace hard-block.** Any `privacy-*`
  finding from actuary blocks marketplace promotion. There is no
  advisory-override for privacy. For the toolshed marketplace, the deterministic
  `scripts/privacy-scan` pre-push hook is the backstop, but catch it here first.
- **Promotion is human-triggered.** Always confirm the actual stage change with
  the user (Step 5) before writing anything. `--dry-run` stops after the verdict.
- **Compose other skills through the harness, not by copying their internals.**
  In Claude Code, invoke `actuary:skill-audit` via the `Skill` tool. In Codex,
  use the available skill invocation surface when present; otherwise read the
  Actuary `SKILL.md` and apply its workflow directly. Use this plugin's own
  `_shared` scripts and `scripts/privacy-scan` (toolshed repo infra) by name.
- **Toolshed pushes go to main directly; never edit plugin caches.** When the
  marketplace target is toolshed, edit source in the toolshed repo, bump
  `plugin.json` (both manifests), and push to main. Other marketplace targets
  stay documented, human-driven tails (Step 6).

## Arguments

`$ARGUMENTS`:

- `<skill-or-tool>` (required) — a `wiki/skills/` or `wiki/tools/` slug, an
  entity name, or a path to a local skill directory containing `SKILL.md`.
- `--to <stage>` (optional) — target stage. Default: the next stage up from the
  entity's current stage. Valid promotion targets are `marketplace-ready` and
  `marketplace`.
- `--marketplace <repo-path-or-name>` (optional) — marketplace git repo target.
  If omitted, default to `memento`; ask only if `memento` cannot resolve to a
  concrete marketplace git repo. `toolshed` means the toolshed repo marketplace.
- `--dry-run` (optional) — run the gates and print the verdict + proposed
  change, then stop. Writes nothing, asks nothing.

## Step 1: Resolve the entity and its current stage

1. Resolve the target to a `wiki/skills/<slug>.md` or `wiki/tools/<slug>.md`
   page (and, when promoting outward, its source files — a local skill
   directory such as `.claude/skills/<name>/`, a Codex skills directory, or the
   toolshed `plugins/<plugin>/skills/<name>/`).
2. Resolve the target marketplace git repo using the Marketplace target rules
   above. Normalize `memento` to the active Memento/RSI git repo and `toolshed`
   to the toolshed repo root. If the target cannot be resolved, ask the user
   before running any gates.
3. Read the page frontmatter: `promotion_stage`, `promotion_blockers`,
   `dedup_of`, `last_eval_pass`.
4. Read `wiki/skills/_promotion-ledger.md` and find the latest dated entry for
   this entity.
5. **Consistency gate.** If the page `promotion_stage` and the ledger's latest
   entry disagree, STOP: report the mismatch and that the ledger is authority.
   Do not proceed until reconciled (through this skill).
6. Determine the target stage (`--to` or next-up). If the entity is already at
   or above the target, report and stop.

## Step 2: Static Gate-1 — actuary tier verdict (privacy + portable spec)

Invoke `actuary:skill-audit` against the entity's **source files** (the local
skill directory or marketplace skill directory, not just the wiki page). Use
native skill composition where the harness exposes it; otherwise follow the
Actuary skill workflow directly in the current session. Because promotion always
targets a marketplace repo, run Actuary with the marketplace tier:

```bash
actuary:skill-audit <source-skill-or-plugin> --tier marketplace
```

Read back `static-verdict: ready|not-ready`, the privacy findings (by
`privacy-*` rule key, masked), and the portable L1 result. Accept the legacy
`verdict:` alias only when `static-verdict:` is absent. Privacy hard-blocks
marketplace promotion and portable L1 must be clean, but a static-ready result
does not prove behavioral or final promotion readiness.

## Step 3: Gate-2 — behavioral (deferred)

The harness-neutral behavioral gate (skill-used + outcome + cost) is not yet
wired. Checked-in eval fixtures are evidence inputs, not a synthesized pass.
Treat it as:

- `marketplace-ready`: **advisory** — note it is unproven, do not block on it.
- `marketplace`: **required-but-unproven** — report it as an unmet prerequisite
  for non-toolshed public marketplaces until Phase-3 CI exists and passes. For
  the default `memento` target and for toolshed, treat it as advisory unless the
  user explicitly raises the bar for that publication.

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
requirements are met, confirm with the user via `AskUserQuestion` when the
harness exposes it, or a single plain chat confirmation otherwise:

> "Promote `<entity>` `<from>` -> `<to>`? Gate-1 ready; <gate-2 note>. This will
> <mechanics>. Proceed?"

Promotion is human-triggered: write nothing until the user says yes.

## Step 6: Perform the promotion (only on explicit OK)

Mechanics depend on the target stage:

- **`marketplace-ready`** — the function is genericized and gate-clean for the
  named marketplace, but the publication has not landed yet; record the stage +
  marketplace target + any residual `promotion_blockers`.
- **`marketplace` with `--marketplace memento` or no `--marketplace`** — the
  function is accepted into the active Memento/RSI target. Record the stage and
  ledger entry in the Memento. Move source files only when the user explicitly
  confirmed that source move in Step 5.
- **`marketplace` with `--marketplace toolshed`** — the function lives in the
  toolshed repo. If it is not already there: edit the toolshed source
  (synthetic placeholders only — no real IDs, paths, or customer data), bump
  `version` in BOTH `plugin.json` manifests, run `node scripts/privacy-scan`
  from the toolshed root (must exit 0), commit, and push to `main`. The pre-push
  hook re-runs the scan as the backstop.
- **`marketplace` with any other marketplace target** — the external marketplace
  move stays a documented, human-driven tail. Confirm any required behavioral CI
  or marketplace-specific checks are green, then the user drives that
  marketplace change. `promote` records the stage and ledger entry once the user
  confirms the external move landed.

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
- Push without the explicit Step 5 confirmation; non-toolshed marketplace
  publication remains a human-driven tail.
