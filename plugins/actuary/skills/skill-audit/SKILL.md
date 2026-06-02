---
name: skill-audit
description: >
  Audit Agent Skills against the agentskills.io spec and authoring best
  practices. Use when the user asks to "audit", "triage", "review", "lint",
  or "check" a skill, plugin, or marketplace; when reviewing a SKILL.md
  before merging it; or when looking for description-tuning, progressive-
  disclosure, or Gotchas opportunities. Produces a layered report — L1 spec
  compliance (pass/fail), L2 structural metrics (counts), L3 craft
  recommendations (ranked) — plus a prioritized quick-wins list. With
  `--tier <local|toolshed|marketplace>` it also emits a promotion-readiness
  verdict gated on a privacy/genericization scan (real IDs, machine paths, key
  material) and L1 spec compliance. Read-only: never modifies the audited
  skills. Trigger even when the user doesn't say "audit" if they're asking for a
  structured quality review of skill files or whether a skill is ready to promote.
argument-hint: "[<skill-path>|<plugin-path>|<repo>] [--quick-wins-only] [--tier <local|toolshed|marketplace>]"
user-invocable: true
allowed-tools: Read Glob Grep Bash
---

# Skill Audit

Audit Agent Skills against the canonical [agentskills.io](https://agentskills.io)
spec and authoring guides. Produces a layered, read-only report:

- **L1** — spec compliance (pass/fail).
- **L2** — structural metrics (counts, thresholds).
- **L3** — craft recommendations (ranked, judgment-laden).

Plus a prioritized quick-wins shortlist.

## Gotchas

- **Read `references/criteria.md` first.** It pins the L1/L2/L3 criteria *and*
  the canonical rule-key catalog. Do not score from general intuition.
- **Every finding must cite a rule key from the catalog.** Format:
  `- [<layer> <severity>] rule: <rule-key> — <one-line what>`. The rule key
  is what makes the report machine-parseable later — keep the format stable.
  If the catalog doesn't cover a concern, put it in open questions or
  residual risk instead of inventing ad-hoc strings.
- **Read-only.** Never edit the audited skills, never write into the audit
  target's directory tree. The report is the only output.
- **L1 and L2 are quantitative; L3 is judgment.** Do not produce a single
  craft "score" — list ranked findings with severities (`high`/`medium`/`low`).
  Quote the SKILL.md for each finding when possible.
- **Don't recommend running the skill.** This audit only reads files.
- **Token estimate is ~4 chars/token.** Use it for L2 thresholds; do not
  invent a tokenizer.
- **Generic advice is anti-gotcha.** When evaluating L3 Gotchas quality,
  flag entries that say "handle errors appropriately" or "follow best
  practices" — those add no information.

## Arguments

`$ARGUMENTS` is the audit target. Resolve in this order:

1. **Single skill** — a path to a directory containing `SKILL.md`, or a path
   to a `SKILL.md` file directly. Audit just that skill.
2. **Plugin** — a path to a directory containing `.claude-plugin/plugin.json`
   or `.codex-plugin/plugin.json`, or a `skills/` subdirectory. Audit every
   `SKILL.md` under `skills/`.
3. **Repo / marketplace** — a path to a directory containing
   `.claude-plugin/marketplace.json` or `plugins/`. Audit every `SKILL.md`
   under every plugin.
4. **No argument** — treat the current working directory as the target and
   resolve as above.

Optional flag: `--quick-wins-only` — skip the per-skill L1/L2/L3 sections
and emit just the cross-cutting quick-wins shortlist.

Optional flag: `--tier <local|toolshed|marketplace>` — also run the
privacy/genericization rule class and emit a promotion-readiness verdict for
that tier (see Step 6.5). Composes with a full audit or with
`--quick-wins-only`. This is the input the `memento:promote` flow consumes as
Gate-1 — it does not push or modify anything.

## Procedure

### Step 1: Read the criteria

Read `references/criteria.md` in full. The audit applies its definitions
literally — do not improvise thresholds or rules.

### Step 2: Resolve the target and inventory skills

Detect target type:

```bash
TARGET="${ARG:-.}"
if [ -f "$TARGET/SKILL.md" ] || [ "$(basename "$TARGET")" = "SKILL.md" ]; then
  MODE=skill
elif [ -d "$TARGET/skills" ] || [ -f "$TARGET/.claude-plugin/plugin.json" ]; then
  MODE=plugin
else
  MODE=repo
fi
```

Build the skill list:

```bash
case "$MODE" in
  skill)  SKILLS=("$TARGET/SKILL.md") ;;
  plugin) SKILLS=( $(find "$TARGET/skills" -name SKILL.md | sort) ) ;;
  repo)   SKILLS=( $(find "$TARGET" -path '*/skills/*/SKILL.md' | sort) ) ;;
esac
```

For each `SKILL.md` collect the inventory row: body lines, body chars (token
estimate = chars / 4), description chars, presence of `references/`,
`scripts/`, `assets/` directories.

```bash
for f in "${SKILLS[@]}"; do
  dir=$(dirname "$f")
  body_chars=$(awk '/^---$/{c++; next} c>=2{print}' "$f" | wc -c | tr -d ' ')
  body_lines=$(awk '/^---$/{c++; next} c>=2{print}' "$f" | wc -l | tr -d ' ')
  # description char count, references presence, etc. — Read the file with
  # the Read tool for parsing rather than chaining shell more.
done
```

Read each `SKILL.md` with the `Read` tool to parse frontmatter and section
structure. Bash is for size measurement and file enumeration; YAML parsing
and section detection happen in-context.

### Step 3: L1 spec compliance

For each skill, check every L1 rule from `references/criteria.md`. Record
defects per skill. A skill with zero defects gets `OK`.

Common defects to test:
- `name` missing, malformed, or not matching directory.
- `name` contains `<`/`>` or the substrings `anthropic`/`claude`.
- `description` missing, empty, or > 1024 chars.
- `description` contains `<`/`>`.
- `compatibility` > 500 chars.
- `license` not a string when present.
- `allowed-tools` present but not a string (YAML list ≠ spec — flag as warn).

### Step 4: L2 structural metrics

For each skill, compute:
- Body lines, body tokens (chars / 4).
- Description chars.
- Inline fenced code blocks ≥ 30 lines (candidates for `assets/`).
- Sections (`## …`) whose body exceeds 50 lines (candidates for `references/`).
- Presence of `references/`, `assets/`, `scripts/`.

Flag values past the thresholds in `references/criteria.md`. Do not flag
in-bounds values.

### Step 5: L3 craft analysis

For each skill, read the SKILL.md body in full (already in context from
Step 2) and produce **ranked findings** per the L3 criteria. Each finding:

- Severity (`high` / `medium` / `low`).
- One-line **what**, quoting SKILL.md where possible.
- One-line **why** referencing the best-practice.
- One-line **fix sketch** — direction only, do not prescribe wording.

Aim for 0–6 findings per skill. If a skill is in great shape, the section
can be brief — do not invent findings to pad.

### Step 6: Quick-wins synthesis

Across the audit, surface cross-cutting recommendations sorted by impact
÷ effort. Bias toward changes that:
- Touch many skills (e.g., "add Gotchas to N skills").
- Are mechanical (template extractions, version bumps).

Cap at 5–7 items. Reference the per-skill findings the items roll up from.

### Step 6.5: Tier verdict (only when `--tier` is passed)

Run the **privacy / genericization** rule class from `references/criteria.md`
across every audited skill's files (SKILL.md, `references/`, `scripts/`,
`assets/`). Use Grep/Read — recognize concrete instances of each `privacy-*`
class (machine paths, cloud keys, key material, chat object IDs, internal
emails, customer slugs, `private/` references). This is the agent-time advisory;
the deterministic enforcement is `scripts/privacy-scan` at the pre-push boundary
— do **not** invoke it from here, just cite the same rule keys.

Then apply the **tier bars** table from `references/criteria.md` and emit one
verdict per audited skill:

- Collect blocking findings for the tier: any `privacy-*` finding (hard-block at
  `toolshed`/`marketplace`); any L1 defect (hard requirement at
  `toolshed`/`marketplace`); for `marketplace`, behavioral-CI + dedup are
  prerequisites **out of audit scope** — report them as unmet-unless-proven, not
  as a pass.
- Verdict is `ready` only if every hard requirement for the tier is met;
  otherwise `not-ready`, listing the blocking rule keys.

Mask any real value you cite (e.g. `/U…dh`) — never reproduce a real ID, path,
or key in the report; the report is itself a public-bound artifact when the
audited target is.

### Step 7: Render the report

Use the template in `assets/templates/report.md`. Match its structure
exactly — the rule-key format on every finding line keeps the report
machine-parseable for any future eval runner. If `--quick-wins-only` was
passed, render only the inventory + quick-wins sections; skip the
per-skill L1/L2/L3 sections. If `--tier` was passed, also render the
**Tier verdict** section from the template (it stays machine-parseable: one
`verdict: ready|not-ready` line per skill plus the blocking rule keys).

## What this skill does *not* do

- Run the audited skills.
- Modify any audited file.
- Score craft numerically across L3.
- Speculate about behavior not visible in `SKILL.md` and adjacent files.


## References

- `references/criteria.md` — pinned L1/L2/L3 criteria and rule-key
  catalog from agentskills.io.
- `assets/templates/report.md` — canonical report shape.
