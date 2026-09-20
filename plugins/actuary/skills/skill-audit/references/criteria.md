# Skill audit criteria

This is the operational rubric for a read-only design audit. Mechanical L1 and
L2 results come from `scripts/analyze`; do not reinterpret its measurements.
For source pins and empirical detail, read `evidence.md` only when needed.

## Confidence classes

- **Portable requirement:** an open Agent Skills specification rule. A defect
  can fail L1.
- **Harness profile:** documented behavior of one host. Report separately from
  portable compliance.
- **Empirical design signal:** associated with better or worse performance in
  controlled studies. Apply only when the target contains the named mechanism.
- **Authoring heuristic:** useful judgment with weaker evidence. Keep advisory;
  never assign high severity without a concrete failure mechanism.

## L1 — portable specification

The analyzer checks the required frontmatter delimiters, `name`, `description`,
optional field shapes, directory/name agreement, and a non-empty Markdown body.
An unsupported YAML construct is an analysis warning, not automatically a
defect. Portable defects use the analyzer's rule keys verbatim.

## Harness profiles

Harness findings never change portable L1.

### Claude

The analyzer checks documented Claude constraints:

- `name` and `description` contain no `<` or `>`.
- `name` contains neither `anthropic` nor `claude`.

### Codex

Codex may shorten descriptions when the initial installed-skill list approaches
its context budget and may omit skills from very large lists. Apply:

- **`codex-description-frontloading`** — medium only when the distinguishing
  user intent or trigger appears late enough that shortening would leave a
  generic or misleading opening. Do not demand a fixed sentence form.
- **`codex-pool-metadata-pressure`** — advisory when analyzer pool metadata is
  near or above 8,000 characters. Identify description collisions and overly
  long metadata before recommending arbitrary shortening.

These are discovery-performance signals, not content-quality preferences.

## L2 — structural measurements

The analyzer reports values and flags these soft limits:

- body over 500 lines;
- body over approximately 5,000 tokens (`chars / 4`);
- description over 900 characters;
- fenced blocks at least 30 lines;
- level-two sections over 100 lines.

Threshold findings are candidates for inspection. They are not proof that
content should move or be deleted.

## L3 — craft judgment

### Discovery description

- Describe the user intent and when the skill applies; do not lead with
  internal implementation.
- Fire `description-no-triggers` only when no concrete request, artifact,
  context, or intent distinguishes the skill. Literal quoted user phrases are
  optional.
- Fire `description-keyword-overfit` for repetitive phrase lists that appear
  tuned to examples rather than a coherent intent boundary.
- Fire `description-anti-triggers-missing` only when an adjacent skill or common
  request is likely to be confused with this one.
- First- or second-person capability claims can impair discovery consistency;
  keep `description-voice-first-person` low unless they obscure the subject.
- Fire `description-under-specified` only when the description is both brief
  and materially vague. There is no minimum character count.
- Flag actual mutually exclusive instructions as `description-contradictions`.

### Instruction design

- `body-explains-known-concepts`: substantial context explains facts a capable
  agent already knows without changing a decision.
- `options-without-default`: several equivalent tools or approaches are listed
  where a default would reduce indecision.
- `declarations-over-procedures`: the skill demands a specific deliverable but
  supplies no useful method, decision criteria, or verification approach.
- `over-prescriptive`: rigid sequencing constrains flexible work without a
  safety, compatibility, or correctness reason.
- `instruction-shouting`: repeated capitalized absolutes replace explanation.
  Scoped emphasis with a stated reason is fine.
- `windows-style-paths`: portable instructions assume backslash paths.
- `time-sensitive-info`: date-bound guidance will silently rot.
- `inconsistent-terminology`: competing terms make instructions ambiguous.
- `mcp-tool-unqualified`: an MCP tool name lacks its server qualification.

### Performance-oriented mechanisms

These are empirical design signals, not guarantees of task success:

- `knowledge-dump-no-procedure`: a workflow skill supplies mostly declarative
  facts with no procedural skeleton. Reference-oriented skills are exempt.
- `undistilled-trajectory-content`: exploration, failures, or transcript prose
  remains where a distilled procedure would be cheaper and clearer.
- `applicability-boundary-missing`: a compact procedure has contexts where it
  should adapt or stop, but never names them.
- `brittle-context-assumptions`: paths, versions, services, or resource names
  are asserted without a check-or-adapt step.
- `verification-anchors-missing`: the workflow produces checkable artifacts but
  never says what evidence distinguishes success from failure.
- `description-confusable-in-pool`: two installed skills claim materially
  overlapping intents without a useful distinguishing boundary.
- `single-pipeline-no-fallback`: a heavyweight mandatory pipeline displaces a
  stronger default for simple cases or delegates to an opaque solver the agent
  cannot debug. Do not penalize exact procedures for fragile operations.
- `uncurated-generation-provenance`: fire only on affirmative evidence that a
  skill was generated in one pass without curation or design validation. Never
  infer provenance from style or co-authorship metadata.

### Progressive disclosure and resources

- `nested-references`: instructions require following references more than one
  level away from `SKILL.md`.
- `large-reference-no-toc`: a reference over 100 lines lacks navigation.
- `template-not-extracted`: a substantial output template consumes the main
  instructions despite being loadable on demand.
- `gotchas-missing`: specific environment traps are scattered rather than
  consolidated. Do not require a Gotchas section by length alone.
- `gotchas-generic`: a Gotchas section contains generic advice rather than
  facts the agent would otherwise miss.
- `validation-loop-missing`: destructive or batch work lacks a proportionate
  plan, validation, and stopping condition.

### Bundled scripts

Inspect scripts as text; never execute target scripts.

- Pin versions in transient package-runner commands.
- Document `--help` for user-facing helpers.
- Prefer actionable errors over `invalid input`.
- Prefer structured output when downstream automation consumes it.
- Flag blocking TTY prompts because agent runs are commonly non-interactive.

## Optional privacy review

With `--privacy`, report concrete disclosure risks using the `privacy-*` keys.
Mask values in the report. Generic placeholders, generic directory layouts,
and a statement that `private/` is protected are safe. Real people, groups,
accounts, paths, or private-data examples are not generic merely because they
appear in documentation. Privacy findings do not create a release verdict.

## Severity

| Severity | Use |
|---|---|
| high | portable defect; clear unsafe disclosure; design likely to misroute or destabilize ordinary use |
| medium | concrete structure or craft issue with a plausible performance cost |
| low | localized heuristic or maintainability improvement |

## Rule catalog

Every finding uses one of these stable keys.

### L1 — portable specification

| Key | What it checks |
|---|---|
| `frontmatter-valid-yaml` | frontmatter delimiters and supported YAML shape parse cleanly |
| `description-required` | `description` exists |
| `name-required` | `name` exists |
| `name-length` | `name` is 1–64 characters |
| `name-format` | lowercase alphanumeric components separated by single hyphens |
| `name-matches-directory` | `name` equals its parent directory |
| `description-non-empty` | description contains text |
| `description-length-max` | description is at most 1,024 characters |
| `compatibility-shape` | compatibility is a string when present |
| `compatibility-length-max` | compatibility is at most 500 characters |
| `license-shape` | license is a string when present |
| `metadata-shape` | metadata is a string-to-string map when present |
| `allowed-tools-shape` | allowed-tools is a string when present |
| `body-present` | Markdown exists after frontmatter |

### Harness profiles

| Key | Profile | What it checks |
|---|---|---|
| `name-no-xml-tags` | Claude | name contains no XML tag characters |
| `name-no-reserved-words` | Claude | name excludes `anthropic` and `claude` |
| `description-no-xml-tags` | Claude | description contains no XML tag characters |
| `codex-description-frontloading` | Codex | distinguishing use case survives description shortening |
| `codex-pool-metadata-pressure` | Codex | installed-pool metadata approaches the fallback initial-list budget |

### L2 — structure

| Key | What it flags |
|---|---|
| `body-lines-soft-max` | body exceeds 500 lines |
| `body-tokens-soft-max` | body exceeds approximately 5,000 tokens |
| `description-length-max-soft` | description exceeds 900 characters |
| `inline-large-template` | fenced block is at least 30 lines |
| `large-section` | level-two section exceeds 100 lines |

### L3 — craft

| Key | What it flags |
|---|---|
| `description-implementation-led` | description leads with implementation rather than user intent |
| `description-no-triggers` | no concrete request, artifact, context, or intent distinguishes the skill |
| `description-keyword-overfit` | repetitive trigger phrases overfit examples |
| `description-anti-triggers-missing` | likely adjacent request lacks a distinguishing boundary |
| `description-voice-first-person` | first/second-person capability framing obscures discovery subject |
| `description-under-specified` | brief and materially vague description |
| `description-contradictions` | mutually exclusive instructions |
| `name-vague` | generic name such as helper, utils, tools, or assistant |
| `body-explains-known-concepts` | context explains facts without changing decisions |
| `options-without-default` | equivalent choices lack a default |
| `declarations-over-procedures` | demanded output lacks useful method or criteria |
| `over-prescriptive` | rigid procedure lacks a concrete reason |
| `instruction-shouting` | repeated capitalized absolutes replace reasoning |
| `windows-style-paths` | portable instructions use backslash paths |
| `time-sensitive-info` | guidance will silently expire |
| `inconsistent-terminology` | competing terms create ambiguity |
| `mcp-tool-unqualified` | MCP tool lacks server qualification |
| `nested-references` | reference chain is deeper than one level |
| `large-reference-no-toc` | long reference lacks navigation |
| `knowledge-dump-no-procedure` | workflow is declarative without procedural anchors |
| `undistilled-trajectory-content` | raw exploration remains in the skill body |
| `applicability-boundary-missing` | procedure omits material adapt/stop conditions |
| `brittle-context-assumptions` | environment facts lack check-or-adapt handling |
| `verification-anchors-missing` | checkable result lacks verification evidence |
| `description-confusable-in-pool` | installed descriptions overlap materially |
| `single-pipeline-no-fallback` | heavyweight pipeline displaces a better simple default |
| `uncurated-generation-provenance` | affirmed one-shot generation lacks curation evidence |
| `gotchas-missing` | named operational traps are scattered |
| `gotchas-generic` | Gotchas contain generic advice |
| `template-not-extracted` | substantial reusable template is inline |
| `validation-loop-missing` | risky operation lacks validation and stopping condition |

### Scripts

| Key | What it flags |
|---|---|
| `script-versions-unpinned` | transient package execution lacks a version |
| `script-help-missing` | user-facing helper lacks help documentation |
| `script-error-messages-generic` | errors omit actionable context |
| `script-output-unstructured` | composable output is unnecessarily free-form |
| `script-interactive` | script blocks on TTY input |

### Privacy

| Key | What it flags |
|---|---|
| `privacy-machine-path` | concrete machine home path |
| `privacy-cloud-key` | cloud access key identifier |
| `privacy-key-material` | embedded private key or credential material |
| `privacy-slack-id` | concrete chat/workspace object identifier |
| `privacy-internal-email` | real internal or personal email example |
| `privacy-customer-slug` | real customer, tenant, project, or account identifier |
| `privacy-real-person` | real person used as an example or fixture |
| `privacy-real-group` | real group or affiliation used concretely |
| `privacy-private-path-ref` | concrete private-data child path or content |
| `privacy-instance-specific` | private local ruleset matched sensitive instance data |

## Non-goals

- Do not run the target.
- Do not judge its task output.
- Do not produce a single craft score.
- Do not issue release, promotion, or readiness verdicts.
