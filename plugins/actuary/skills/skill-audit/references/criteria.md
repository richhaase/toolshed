# Skill audit criteria

Pinned criteria sourced from the [agentskills.io](https://agentskills.io) spec
and authoring guides. Read this file before scoring a skill so the audit stays
calibrated to the canonical guidance, not the agent's general intuition.

Sources (commit-pin if precision matters):
- [Specification](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx)
- [Best practices](https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/best-practices.mdx)
- [Optimizing descriptions](https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/optimizing-descriptions.mdx)
- [Evaluating skills](https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/evaluating-skills.mdx)
- [Using scripts](https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/using-scripts.mdx)

The audit applies three layers. **L1 and L2 are pass/fail or quantitative.
L3 is judgment-laden and produces ranked recommendations, not verdicts.**

## L1 — Spec compliance (hard pass/fail)

Every finding here is a defect. Block the skill from claiming "spec-conformant."

### Frontmatter shape
- File contains a YAML frontmatter block delimited by `---` lines at the top.
- YAML parses without errors.
- `name` and `description` are both present.

### `name` field
- Length 1–64 characters.
- Matches `^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$|^[a-z0-9]$` — lowercase
  alphanumerics and single hyphens; no leading, trailing, or consecutive hyphens.
- Equals the parent directory name.

### `description` field
- Length 1–1024 characters (count rendered text, not YAML syntax).
- Non-empty.

### `compatibility` field (optional)
- If present, length 1–500 characters.

### `metadata` field (optional)
- If present, must be a map of string keys.

### `allowed-tools` field (optional, experimental)
- If present, a string (space-separated) per the spec. (YAML lists are widely
  used in practice but not what the spec says — flag list form as L1 warn.)

### Body
- Markdown body present after frontmatter.

## L2 — Structural metrics (quantitative)

Numbers, not verdicts. Report the value and flag values past the listed
thresholds. Don't fail the skill — flag.

### SKILL.md size
- **Body lines** target ≤ 500. Flag at 500+.
- **Body tokens** target ≤ 5,000. Estimate at ~4 chars/token. Flag at 5,000+.
- **Description length** flag at <100 chars (likely under-specified) and at
  >900 chars (approaching the 1,024 ceiling, no headroom for tuning).

### Progressive disclosure
- Count inline fenced code blocks ≥ 30 lines. Each is a candidate for
  `assets/templates/` per best-practices ("Templates for output format").
- Count level-2 sections (`## `) whose body exceeds 50 lines. Each is a
  candidate for `references/`.
- Note presence of `references/`, `assets/`, `scripts/` directories.

### Scripts
- For each file in `scripts/`, note language, presence of inline dependency
  declarations (PEP 723, `npm:`/`jsr:` imports, `bundler/inline`), and
  whether `--help` is documented.

## L3 — Craft recommendations (judgment, ranked)

These are guided reads of the SKILL.md against authoring best-practices.
Output as **ranked recommendations** with severity (`high`, `medium`, `low`)
and a one-line rationale that quotes the SKILL.md when possible. Do not
produce a single craft "score" — list the findings.

### Description quality (from optimizing-descriptions)
- **Imperative phrasing.** Frame as "Use this skill when…" rather than
  "This skill does…". Flag opening clauses that lead with "internal" or
  "implementation" framing instead of user intent.
- **User intent, not implementation.** The description should match what the
  user asks for, not how the skill works internally.
- **Pushy / explicit triggers.** Should enumerate concrete user phrases,
  including casual paraphrases. Flag descriptions with zero example trigger
  phrases.
- **Anti-triggers.** Bonus when the description names what the skill is *not*
  for — these prevent false triggers from adjacent skills.
- **Avoid keyword overfitting.** Long lists of nearly-identical phrases
  (e.g., "do X", "X this", "have you do X", "could you X") are a smell —
  they overfit the eval set rather than generalizing.

### Body craft (from best-practices)
- **Add what the agent lacks, omit what it knows.** Flag content that explains
  general concepts (what HTTP is, what a database does, etc.).
- **Defaults, not menus.** Flag prose that lists multiple equal options
  ("you can use X, Y, or Z…") without naming a default.
- **Procedures, not declarations.** Flag instructions that describe a specific
  output ("the result should be…") without describing the *approach*.
- **Match specificity to fragility.** Prescriptive sequences for fragile ops
  (migrations, destructive commands) are good. Rigid prescriptions for
  flexible work are over-constraint.

### Gotchas section
- **Presence.** Flag missing `## Gotchas` (or equivalently named) section
  when the skill body is long enough (>200 lines) that the agent will
  benefit from a consolidated callout.
- **Quality.** Gotchas should be specific, environment-bound facts the agent
  will get wrong without them. Generic advice ("handle errors appropriately")
  is anti-gotcha and should be flagged.

### Templates and validation
- **Templates for output format.** When the skill expects specific output
  shape, an inline or referenced template is recommended over prose.
- **Validation loops / plan-validate-execute.** For destructive or batch
  operations, recommend the plan-validate-execute pattern when absent.

### Scripts (from using-scripts, when `scripts/` is present)
- **Pinned versions** in any `npx`/`uvx`/etc. invocations.
- **`--help` documented.**
- **Helpful error messages.** Flag if scripts use generic `Error: invalid input`.
- **Structured output.** Prefer JSON/CSV/TSV over free-form text.
- **No interactive prompts.** Hard requirement — agents run in non-interactive
  shells.

## Severity assignment

| Severity | When to use |
|---|---|
| `high` | L1 violation, missing description triggers, body well over guidance ceilings, scripts with interactive prompts, missing Gotchas in long skills with non-obvious behavior |
| `medium` | L2 flags, weak description (no trigger phrases or implementation-led lead), inline templates ≥30 lines, missing defaults in option lists |
| `low` | Minor wording, optional sections missing in short skills, style preferences |

## Rule catalog

Every finding emitted by the audit must reference one of these canonical
kebab-case rule keys. The keys keep the rendered report
(`assets/templates/report.md`) machine-parseable for future eval runners.
Adding a new detection means adding a new key here.

### L1 — spec compliance

| Key | What it checks |
|---|---|
| `frontmatter-valid-yaml` | Frontmatter block is present and parses as YAML |
| `frontmatter-required-fields` | `name` and `description` both present |
| `name-length` | `name` is 1-64 characters |
| `name-format` | lowercase alnum + single hyphens, no leading/trailing/consecutive hyphens |
| `name-matches-directory` | `name` equals parent directory name |
| `description-non-empty` | `description` is non-empty |
| `description-length-max` | `description` ≤ 1024 characters |
| `compatibility-length-max` | `compatibility`, if present, ≤ 500 characters |
| `metadata-shape` | `metadata`, if present, is a string-keyed map |
| `allowed-tools-shape` | `allowed-tools`, if present, is a string (warn on YAML list) |
| `body-present` | Markdown body exists after frontmatter |

### L2 — structural metrics

| Key | What it flags |
|---|---|
| `body-lines-soft-max` | Body > 500 lines |
| `body-tokens-soft-max` | Body > 5,000 tokens (chars / 4) |
| `description-length-min-soft` | Description < 100 characters |
| `description-length-max-soft` | Description > 900 characters (no headroom) |
| `inline-large-template` | Fenced code block ≥ 30 lines (assets/ candidate) |
| `large-section` | Level-2 section body > 50 lines (references/ candidate) |

### L3 — craft recommendations

| Key | What it flags |
|---|---|
| `description-implementation-led` | Description leads with implementation framing instead of user intent |
| `description-no-triggers` | Description has no example user phrases |
| `description-keyword-overfit` | Description has long lists of near-identical phrases |
| `description-anti-triggers-missing` | Description does not name what the skill is *not* for (low-severity) |
| `body-explains-known-concepts` | Body explains general concepts the agent already knows |
| `options-without-default` | Body lists multiple equal options without naming a default |
| `declarations-over-procedures` | Body prescribes specific outputs without describing the approach |
| `over-prescriptive` | Rigid prescriptions for flexible work |
| `gotchas-missing` | Long body (>200 lines) lacks an explicit `## Gotchas` section |
| `gotchas-generic` | Gotchas section contains generic advice rather than specific facts |
| `template-not-extracted` | Output-format template is inline when it could move to `assets/` |
| `validation-loop-missing` | Destructive/batch ops lack a plan-validate-execute pattern |

### Scripts (when `scripts/` is present)

| Key | What it flags |
|---|---|
| `script-versions-unpinned` | `npx`/`uvx`/etc. invocations don't pin versions |
| `script-help-missing` | Script lacks `--help` documentation |
| `script-error-messages-generic` | Errors say "invalid input" without context |
| `script-output-unstructured` | Output is free-form text where JSON/CSV would compose |
| `script-interactive` | Script blocks on TTY input — agents run non-interactive (high) |

## What this audit deliberately does *not* do

- **Run the skill.** Trigger-rate and output-quality evaluation are separate
  concerns (see `optimizing-descriptions.mdx` and `evaluating-skills.mdx`).
  This audit only reads `SKILL.md` and adjacent files.
- **Modify the skill.** Read-only.
- **Score skills numerically across the L3 layer.** Craft is multi-dimensional;
  a single score hides the actual findings.
