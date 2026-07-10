# Skill audit report — `<target>`

`<target>` = single skill path | plugin path | repo / marketplace root.
Date: YYYY-MM-DD. Auditor: actuary/skill-audit.

**Finding format:** every finding line begins with `- [<layer> <severity>] rule: <rule-key> —`
where `<rule-key>` is one of the canonical keys in
`references/criteria.md` § Rule catalog. The format keeps reports
machine-parseable for any future eval runner — do not paraphrase it.

## Inventory

| Skill | Body lines | Body tokens (~) | Description chars | refs/ | scripts/ | assets/ |
|---|---:|---:|---:|:-:|:-:|:-:|
| <plugin>/<skill> | N | N | N | ✓/– | ✓/– | ✓/– |

(One row per `SKILL.md`. Token estimate at ~4 chars/token.)

## L1 — Portable spec compliance

For each skill, list defects. If none, write `OK`.

### <plugin>/<skill>
- **OK** *(or)*
- [L1 high] rule: name-matches-directory — frontmatter `name` is `foo`, directory is `foo-bar`.
- [L1 high] rule: description-length-max — description is 1187 chars (limit 1024).
- [L1 medium] rule: allowed-tools-shape — `allowed-tools` is a YAML list; spec calls for a space-separated string.

## Harness profiles

List compatibility findings separately from portable L1. If none for a
profile, write `OK`.

### <plugin>/<skill> — Claude profile
- **OK** *(or)*
- [profile medium] rule: name-no-reserved-words — `name` contains a Claude-profile reserved word; portable L1 is unaffected.

## L2 — Structural metrics

For each skill, list flags only — don't repeat values that are within
guidance.

### <plugin>/<skill>
- **OK** *(or)*
- [L2 medium] rule: body-lines-soft-max — body is 612 lines (>500 guideline).
- [L2 medium] rule: description-length-max-soft — description is 947 chars (>900 guideline; little tuning headroom remains).
- [L2 medium] rule: inline-large-template — 3 fenced blocks ≥ 30 lines at lines 234, 412, 580 — candidates for `assets/templates/`.

## L3 — Craft recommendations

For each skill, list ranked findings. Each finding has:
- **Severity** (`high` / `medium` / `low`)
- **Rule key** from the catalog (kebab-case)
- One-line **what**, quoting SKILL.md where possible
- One-line **why** referencing the best-practice
- One-line **fix sketch** — direction only, do not prescribe wording

### <plugin>/<skill>
- [L3 high] rule: description-no-triggers — "Process CSV files." Per optimizing-descriptions, descriptions need to enumerate user intents the skill should activate on. Fix: add 3–5 casual paraphrases ("clean up this csv", "what's the pattern in my sales data").
- [L3 medium] rule: template-not-extracted — Inline 80-line wiki page template (lines 234–315). Best-practices recommends moving long templates to `assets/`. Fix: extract to `assets/templates/wiki-page.md` and reference.
- [L3 medium] rule: gotchas-missing — The body scatters two environment-bound traps ("the CLI exits zero on a partial write" and "workspace IDs differ from channel IDs") without a `## Gotchas` section. Consolidating those named traps prevents predictable misuse.
- [L3 low] rule: options-without-default — "Use pdfplumber, pypdf, or PyMuPDF…" presents a menu. Pick a default and demote alternatives.

## Static Gate-1 readiness

Only when `--tier <tier>` was passed. One block per audited skill. Keep the
`static-verdict:` line machine-parseable. The legacy `verdict:` line is a
compatibility alias for this static gate only. Mask any real value cited in a
finding.

### <plugin>/<skill> — tier: <local|toolshed|marketplace>
- gate: static-1
- static-verdict: ready *(or)* not-ready
- verdict: ready *(or)* not-ready *(compatibility alias; static Gate-1 only)*
- promotion-readiness: unproven *(marketplace: behavioral CI and dedup require separate evidence)*
- privacy: OK *(or list)*
  - [privacy high] rule: privacy-machine-path — `/U…dh` at SKILL.md:46 (use `~/` or `/path/to/`).
  - [privacy high] rule: privacy-internal-email — real address at references/foo.md:12 (use `user@example.com`).
- blocking rule keys: `privacy-machine-path`, `privacy-internal-email`  *(empty when ready)*
- prerequisites out of audit scope (marketplace only): behavioral CI — unproven; dedup — unchecked here. A static-ready result is not final promotion approval.

## Quick-wins shortlist

Cross-cutting recommendations sorted by ratio of impact to effort.

1. **Consolidate the named environment traps in `<a>`, `<b>`, `<c>`.** A
   focused Gotchas section makes those operational facts easier to apply.
2. **Extract `<skill>` templates to `assets/templates/`.** Frees N tokens
   per skill; pure mechanical move.
3. **Tune `<skill>` description to add trigger phrases.** Single-string
   change; biggest activation lever.

## What this audit did not check

- Trigger rate (would require running the skill against a query set).
- Output quality (would require an eval harness with assertions).
- Script behavior (would require running the scripts).
