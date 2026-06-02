# Skill audit criteria

Read this file before scoring a skill so the audit stays calibrated to
the published guidance, not the agent's general intuition.

## Sources

Pinned to `agentskills/agentskills@2d3e01f` (2026-04-22):

| Path | Blob SHA at 2d3e01f |
|---|---|
| `docs/specification.mdx` | `a45ead3` |
| `docs/skill-creation/best-practices.mdx` | `cfe9188` |
| `docs/skill-creation/optimizing-descriptions.mdx` | `8bb2a2f` |
| `docs/skill-creation/evaluating-skills.mdx` | `7c90d54` |
| `docs/skill-creation/using-scripts.mdx` | `11ce443` |
| `docs/skill-creation/quickstart.mdx` | `0d41a87` |
| `docs/client-implementation/adding-skills-support.mdx` | `6c78430` |

Raw fetch URL pattern:
`https://raw.githubusercontent.com/agentskills/agentskills/<sha>/<path>`.

Additional sources:

- <https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices>
- <https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md>
- <https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide>
- <https://help.openai.com/en/articles/9358033>
- <https://developers.openai.com/codex/skills>

## Contents

- L1 — Spec compliance: hard frontmatter and body checks.
- L2 — Structural metrics: size, progressive disclosure, and scripts.
- L3 — Craft recommendations: description quality, body craft, references,
  gotchas, templates, validation, and scripts.
- Severity assignment: how to rank findings.
- Rule catalog: stable keys every finding must cite.
- Deliberate non-goals: what this audit does not do.

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
- Must not contain XML tag characters (`<`, `>`) — Anthropic best-practices.
- Must not contain reserved words `anthropic` or `claude` — Anthropic
  best-practices.

### `description` field
- Length 1–1024 characters (count rendered text, not YAML syntax).
- Non-empty.
- Must not contain XML tag characters — Anthropic best-practices.

### `compatibility` field (optional)
- If present, length 1–500 characters.

### `license` field (optional)
- If present, must be a string. Per `specification.mdx`: "License name or
  reference to a bundled license file."

### `metadata` field (optional)
- If present, must be a map of string keys.

### `allowed-tools` field (optional, experimental)
- If present, a string (space-separated) per the spec. YAML list form is
  widely used in practice but is not spec-conformant — flag as warn.

### Body
- Markdown body present after frontmatter.

## L2 — Structural metrics (quantitative)

Numbers, not verdicts. Report the value and flag values past the listed
thresholds. Don't fail the skill — flag.

### SKILL.md size
- **Body lines** target ≤ 500. Flag at 500+.
- **Body tokens** target ≤ 5,000. Estimate at ~4 chars/token. Flag at
  5,000+. The 5,000-token target comes from
  `client-implementation/adding-skills-support.mdx` (instruction tier).
- **Description length** flag at >900 chars (approaching the 1,024
  ceiling, no headroom for tuning).

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

### Description quality (from optimizing-descriptions + best-practices)
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
- **Third-person voice.** Anthropic best-practices: "Always write in third
  person." Flag first-person ("I can…") and second-person ("You can…").
- **Under-specified descriptions.** A description shorter than ~100
  characters rarely enumerates enough triggers to fire reliably. Heuristic,
  not spec-derived.
- **Contradictions.** OpenAI's GPT-5 prompting guide: "poorly-constructed
  prompts containing contradictory or vague instructions can be more damaging
  to GPT-5 than to other models, as it expends reasoning tokens searching for
  a way to reconcile the contradictions." Flag when description (or body)
  prescribes mutually-exclusive behavior.

### `name` quality (from skill-creator)
- **Vague names.** Flag `helper`, `utils`, `tools`, `assistant`, etc. —
  the skill-creator guide warns these descriptions don't trigger reliably.
- **Gerund-form preference.** `processing-pdfs` reads better than `pdf` for
  task-shaped skills. Low-severity recommendation.

### Body craft (from best-practices + skill-creator)
- **Add what the agent lacks, omit what it knows.** Flag content that explains
  general concepts (what HTTP is, what a database does, etc.).
- **Defaults, not menus.** Flag prose that lists multiple equal options
  ("you can use X, Y, or Z…") without naming a default.
- **Procedures, not declarations.** Flag instructions that describe a specific
  output ("the result should be…") without describing the *approach*.
- **Match specificity to fragility.** Prescriptive sequences for fragile ops
  (migrations, destructive commands) are good. Rigid prescriptions for
  flexible work are over-constraint.
- **Positive instructions over prohibitions.** OpenAI Custom GPT guide:
  prefer "Do X" over long lists of "Don't do Y." Flag bodies where prohibition
  lines outweigh procedure lines.
- **No ALL-CAPS shouting.** skill-creator: "ALL-CAPS `MUST`/`ALWAYS` is a
  yellow flag — reframe and explain why."
- **Forward-slash paths only.** Best-practices: "Always use forward slashes."
  Flag Windows-style `\` separators in body or scripts.
- **No time-sensitive content.** Best-practices warns against "If you're
  doing this before August 2025…" — content that rots silently.
  Recommends a `<details>` "Old patterns" section instead.
- **Consistent terminology.** Best-practices: pick "API endpoint" or "URL",
  not both interchangeably. Low-severity.
- **MCP tools fully qualified.** Best-practices: refer to MCP tools as
  `ServerName:tool_name`, never the bare tool name.

### References / progressive disclosure (from best-practices)
- **Reference depth ≤ 1.** Best-practices: "Keep references one level deep
  from SKILL.md." Flag deeply-nested reference chains.
- **Large references need a ToC.** Best-practices: "For reference files
  longer than 100 lines, include a table of contents." Flag references
  past 100 lines without a `## Contents` (or equivalent) section.

### Gotchas section

Best-practices frames Gotchas as a *pattern*, not a spec rule. The parent
section explicitly notes "not every skill needs all of them — use the ones
that fit your task." There is no body-length trigger in canonical.

- **Presence (judgment-based).** Fire `gotchas-missing` only when the
  auditor can name specific environment-bound traps in the body that the
  agent will get wrong without being told (scattered env invariants,
  "this command silently fails" warnings, schema/identifier mismatches,
  TUI/paste hazards, etc.) and those traps are not consolidated into a
  `## Gotchas` block. Do not fire on body length alone. Quote the traps
  in the finding.
- **Quality.** Gotchas should be specific, environment-bound facts the
  agent will get wrong without them. Generic advice ("handle errors
  appropriately") is anti-gotcha and should be flagged. Canonical
  contrasts gotchas with "general advice" using exactly that phrasing.

### Templates and validation
- **Templates for output format.** When the skill expects specific output
  shape, an inline or referenced template is recommended over prose.
- **Validation loops / plan-validate-execute.** For destructive or batch
  operations, recommend the plan-validate-execute pattern when absent.

### Scripts (from using-scripts, when `scripts/` is present)
- **Pinned versions** in any `npx`/`uvx`/`bunx`/`pipx run`/`deno run npm:`/
  `go run …@vX` invocations.
- **`--help` documented.**
- **Helpful error messages.** Flag if scripts use generic `Error: invalid input`.
- **Structured output.** Prefer JSON/CSV/TSV over free-form text.
- **No interactive prompts.** Hard requirement — agents run in non-interactive
  shells.

## Privacy / genericization (tier gating)

Runs only in `--tier` mode (see SKILL.md). A skill graduating from a local
experiment toward a public repo or marketplace must carry **generic
placeholders only** — never real IDs, machine paths, key material, private-data
references, or **real people and groups**. The Memento is frequently a
*personal* knowledge base, so "real-world references" span **friends, family,
and personal contacts and circles** — not just business entities like an
employer, customers, or a work team. All of them must be genericized for a
public skill. This audit is the **agent-time advisory** that surfaces such
content *before* a push. The deterministic enforcement is a separate
mechanism: `scripts/privacy-scan` (toolshed repo infrastructure, fail-closed)
runs at the pre-push hook and in CI. This audit and that scanner share the same
`privacy-*` rule-key vocabulary so the verdict and the gate agree; the audit
applies the rules by reading the target's files, the scanner enforces them at the
boundary. Do not invoke the scanner from here — cite the rule keys and report.

Apply these by reading + grepping the audited skill's files (SKILL.md,
`references/`, `scripts/`, `assets/`):

- **Machine home paths.** Absolute `/Users/<name>` or `/home/<name>` paths.
  Generic placeholders (`~/`, `/path/to/`, `you`, `user`) are fine.
- **Cloud access keys / key material.** AWS access key IDs (`AKIA…`/`ASIA…`),
  `-----BEGIN … PRIVATE KEY-----` blocks, other embedded credentials.
- **Chat/workspace object IDs.** Slack channel/user/workspace IDs
  (`C…`/`U…`/`W…`/`G…`), and equivalents for other providers.
- **Internal / personal email addresses.** Real employer-domain or personal
  addresses used as concrete examples instead of `user@example.com`.
- **Customer / tenant / account identifiers.** Real customer names, SaaS tenant
  slugs, a `*.atlassian.net`-style cloud ID, a project key, or an account number
  baked into examples or fixtures.
- **Real people.** A real individual — friend, family member, colleague, contact
  — named as a concrete example, trigger phrase, or fixture instead of a
  synthetic placeholder (`Alex`, `a teammate`, `<person>`). Personal, not just
  professional: a spouse, a kid's name, a doctor, a neighbor all count.
- **Real groups / affiliations.** A real team, employer, family, household,
  community, club, school, or friend-circle named concretely instead of a
  generic placeholder (`your team`, `<group>`).
- **`private/` path references.** Literal references to a Memento `private/`
  path (or other walled-off data) from a file destined for a public repo.

Instance-specific *patterns* (a specific employer domain, customer/tenant slugs,
a Slack workspace's ID shapes) are **not** hard-coded here — they live in the
local `PRIVACY_RULESET` the scanner loads and never ship publicly. **Real
people/group names are recognized *semantically* by this audit, not by regex** —
arbitrary names rarely have a stable shape to scan for, which is exactly why the
agent-time review exists alongside the deterministic scanner. This catalog names
the *classes*; the auditor recognizes concrete instances of each.

### Tier bars

`--tier <local|toolshed|marketplace>` turns the per-layer findings into a
graduation verdict. The bars are cumulative:

| Tier | Privacy | L1 spec | L2/L3 craft | Extra |
|---|---|---|---|---|
| `local` | advisory | advisory | advisory | — |
| `toolshed` | **hard-block** (any `privacy-*` finding ⇒ `not-ready`) | must be clean (zero L1 defects) | advisory | — |
| `marketplace` | **hard-block** | must be clean | advisory | behavioral CI + dedup clean (out of audit scope — report as an unmet prerequisite, not a pass) |

Privacy is the one **non-negotiable hard-block at every tier above `local`** —
no advisory-with-override. Everything else is advisory unless a tier names it a
hard requirement. The verdict is `ready` only if every hard requirement for the
tier is met; otherwise `not-ready` with the blocking rule keys listed.

## Severity assignment

| Severity | When to use |
|---|---|
| `high` | L1 violation, missing description triggers, body well over guidance ceilings, scripts with interactive prompts, missing Gotchas when the body contains multiple specific environment-bound traps that aren't consolidated |
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
| `description-required` | `description` field is present |
| `name-required` | `name` field is present |
| `name-length` | `name` is 1–64 characters |
| `name-format` | lowercase alnum + single hyphens, no leading/trailing/consecutive hyphens |
| `name-matches-directory` | `name` equals parent directory name |
| `name-no-xml-tags` | `name` contains no `<` or `>` characters |
| `name-no-reserved-words` | `name` does not contain "anthropic" or "claude" |
| `description-non-empty` | `description` is non-empty |
| `description-length-max` | `description` ≤ 1024 characters |
| `description-no-xml-tags` | `description` contains no `<` or `>` characters |
| `compatibility-length-max` | `compatibility`, if present, ≤ 500 characters |
| `license-shape` | `license`, if present, is a string |
| `metadata-shape` | `metadata`, if present, is a string-keyed map |
| `allowed-tools-shape` | `allowed-tools`, if present, is a string (warn on YAML list) |
| `body-present` | Markdown body exists after frontmatter |

### L2 — structural metrics

| Key | What it flags |
|---|---|
| `body-lines-soft-max` | Body > 500 lines |
| `body-tokens-soft-max` | Body > 5,000 tokens (chars / 4) |
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
| `description-voice-first-person` | Description uses "I"/"You" instead of third person |
| `description-under-specified` | Description < 100 characters (insufficient triggers) |
| `description-contradictions` | Description (or body) prescribes mutually-exclusive behavior |
| `name-vague` | `name` is generic (`helper`, `utils`, `tools`, `assistant`) |
| `body-explains-known-concepts` | Body explains general concepts the agent already knows |
| `options-without-default` | Body lists multiple equal options without naming a default |
| `declarations-over-procedures` | Body prescribes specific outputs without describing the approach |
| `over-prescriptive` | Rigid prescriptions for flexible work |
| `instructions-prohibition-heavy` | Body's "don't / never" lines outweigh "do / use" lines |
| `instruction-shouting` | Body uses ALL-CAPS `MUST`/`ALWAYS` instead of explained reasoning |
| `windows-style-paths` | Body or scripts use `\` path separators |
| `time-sensitive-info` | Body contains date-bound content that will rot |
| `inconsistent-terminology` | Body alternates between equivalent terms (e.g., "API endpoint" / "URL") |
| `mcp-tool-unqualified` | MCP tool referenced without `ServerName:tool_name` qualification |
| `nested-references` | File reference is more than 1 level deep from SKILL.md |
| `large-reference-no-toc` | Reference file > 100 lines without a table of contents |
| `gotchas-missing` | Body contains specific environment-bound traps that aren't consolidated into a `## Gotchas` section (judgment-based, not length-gated) |
| `gotchas-generic` | Gotchas section contains generic advice rather than specific facts |
| `template-not-extracted` | Output-format template is inline when it could move to `assets/` |
| `validation-loop-missing` | Destructive/batch ops lack a plan-validate-execute pattern |

### Scripts (when `scripts/` is present)

| Key | What it flags |
|---|---|
| `script-versions-unpinned` | `npx`/`uvx`/`bunx`/`pipx run`/`deno run npm:`/`go run …@vX` invocations don't pin versions |
| `script-help-missing` | Script lacks `--help` documentation |
| `script-error-messages-generic` | Errors say "invalid input" without context |
| `script-output-unstructured` | Output is free-form text where JSON/CSV would compose |
| `script-interactive` | Script blocks on TTY input — agents run non-interactive (high) |

### Privacy / genericization (only in `--tier` mode)

These mirror the deterministic detectors in `scripts/privacy-scan`. Every one is
a **hard-block at `toolshed` and `marketplace` tiers**, advisory at `local`.

| Key | What it flags |
|---|---|
| `privacy-machine-path` | Absolute `/Users/<name>` or `/home/<name>` machine home path |
| `privacy-cloud-key` | Cloud access key ID (AWS `AKIA…`/`ASIA…`, etc.) |
| `privacy-key-material` | `-----BEGIN … PRIVATE KEY-----` or other embedded credential |
| `privacy-slack-id` | Slack channel/user/workspace object ID (`C…`/`U…`/`W…`/`G…`) |
| `privacy-internal-email` | Real employer-domain or personal email used as a concrete example |
| `privacy-customer-slug` | Real customer / tenant / account identifier (SaaS slug, `*.atlassian.net` cloud ID, project key, account number) in an example or fixture |
| `privacy-real-person` | Real individual (friend, family, colleague, contact) used as a concrete example / trigger / fixture instead of a placeholder |
| `privacy-real-group` | Real group or affiliation (team, employer, family, household, community, club, school, friend-circle) named concretely as an example |
| `privacy-private-path-ref` | Literal `private/` (or other walled-off) path reference in a public-bound file |

## What this audit deliberately does *not* do

- **Run the skill.** Trigger-rate and output-quality evaluation are separate
  concerns (see `optimizing-descriptions.mdx` and `evaluating-skills.mdx`).
  This audit only reads `SKILL.md` and adjacent files.
- **Modify the skill.** Read-only.
- **Score skills numerically across the L3 layer.** Craft is multi-dimensional;
  a single score hides the actual findings.
