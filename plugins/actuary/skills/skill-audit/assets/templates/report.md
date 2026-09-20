# Skill design audit — `<target>`

Date: YYYY-MM-DD. Auditor: actuary/skill-audit.

**Scope:** read-only assessment of writing, structure, portability, and
performance-oriented design. This report does not establish task success.

**Finding format:**
`- [<layer> <severity>] rule: <rule-key> — <finding>`

## Analysis provenance

- analyzer schema: 1
- target mode: skill-file | skill | plugin | repo
- regular skills analyzed: N
- analysis warnings: none *(or list uncertainty without converting it to a pass)*

## Inventory

| Skill | Body lines | Tokens (~) | Description chars | refs | scripts | assets |
|---|---:|---:|---:|:-:|:-:|:-:|
| `<plugin>/<skill>` | N | N | N | ✓/– | ✓/– | ✓/– |

Pool metadata: N characters of name, description, and path data. Codex fallback
initial-list budget: 8,000 characters.

## L1 — Portable specification

Copy deterministic analyzer findings. If none, write `OK`.

### `<plugin>/<skill>`

- **OK** *(or)*
- [L1 high] rule: name-matches-directory — frontmatter name does not match its directory.

## Harness profiles

Harness concerns do not change portable L1.

### `<plugin>/<skill>` — Claude

- **OK** *(or copy analyzer profile findings)*

### `<plugin>/<skill>` — Codex

- **OK** *(or)*
- [profile medium] rule: codex-description-frontloading — shortening could remove the first distinguishing trigger.

### Pool — Codex

- **OK** *(or copy the analyzer pool-budget finding and explain material collisions)*

## L2 — Structure

Copy deterministic flags only. Values already appear in the inventory.

### `<plugin>/<skill>`

- **OK** *(or)*
- [L2 medium] rule: body-lines-soft-max — body is 612 lines.

## L3 — Craft

Rank only evidence-backed findings, at most six per skill.

### `<plugin>/<skill>`

- [L3 high] rule: verification-anchors-missing — the workflow creates a checkable artifact but never defines evidence of success. Rationale: missing verification increases execution ambiguity. Fix direction: name the smallest observable check.
- [L3 medium] rule: description-confusable-in-pool — its audit intent overlaps `<counterpart>` without a distinguishing target boundary. Fix direction: state the object each skill audits.

## Privacy review

Render only with `--privacy`. Mask concrete values. This section carries no
release or readiness verdict.

### `<plugin>/<skill>`

- **OK** *(or)*
- [privacy high] rule: privacy-machine-path — concrete machine path at `SKILL.md:46`; replace it with a placeholder.

## Quick wins

Sorted by expected design impact divided by effort; maximum seven.

1. **`<change>`.** Resolves `<rule-key>` in N skills.

## Open questions and residual risk

Include only concerns the catalog cannot express or analyzer warnings that
prevent a confident conclusion. Omit when empty.

## What this audit did not check

- Live trigger precision or recall.
- Whether the workflow produces the result a user wants.
- Runtime behavior of bundled scripts.
- Release, publication, or promotion readiness.
