# Evidence and source pins

Read this file when auditing the rubric itself, explaining the provenance of a
finding, or refreshing upstream criteria. Ordinary target audits use the
compact operational rules in `criteria.md`.

## Contents

- Source pins
- Documented harness behavior
- Empirical design evidence
- Interpretation boundaries

## Source pins

Pinned to `agentskills/agentskills@69ef37e9424c0a7ea9dd2293b559e43ec8176379`
(2026-08-09):

| Path | Blob SHA |
|---|---|
| `docs/specification.mdx` | `d9a2db0` |
| `docs/skill-creation/best-practices.mdx` | `cfe9188` |
| `docs/skill-creation/optimizing-descriptions.mdx` | `8bb2a2f` |
| `docs/skill-creation/evaluating-skills.mdx` | `7c90d54` |
| `docs/skill-creation/using-scripts.mdx` | `11ce443` |
| `docs/skill-creation/quickstart.mdx` | `0d41a87` |
| `docs/client-implementation/adding-skills-support.mdx` | `6c78430` |

Raw fetch pattern:
`https://raw.githubusercontent.com/agentskills/agentskills/<sha>/<path>`.

Pinned to `anthropics/skills@b0cbd3d`:

| Path | Blob SHA |
|---|---|
| `skills/skill-creator/SKILL.md` | `65b3a40` |

Pinned research:

- `2608.14036v1`, *Demystifying Agent Skills: Why They Work—Until They
  Don't*, submitted 2026-08-14: <https://arxiv.org/abs/2608.14036>
- `2602.12670v4`, *SkillsBench: Benchmarking How Well Agent Skills Work Across
  Diverse Tasks*, 2026-06-14: <https://arxiv.org/abs/2602.12670>
- `2607.07504v1`, *Do LLM-Generated Skills Make Better AI Data Scientists? A
  Component Ablation Across Data-Science Workflows*, 2026-07-08:
  <https://arxiv.org/abs/2607.07504>

Unpinned live documentation, which must be re-read during a criteria refresh:

- <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices>
- <https://learn.chatgpt.com/docs/build-skills>
- <https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide>
- <https://help.openai.com/en/articles/9358033>

## Documented harness behavior

### Portable format

The open format requires a `SKILL.md` with YAML frontmatter containing `name`
and `description`. It defines the portable optional fields and progressive
resource directories. Portable failures belong in L1.

### Claude profile

Claude's current documentation adds XML-character restrictions for `name` and
`description` and reserves `anthropic` and `claude` in names. It recommends
concise instructions, progressive disclosure, one-level reference links,
navigation for long references, explicit workflows, verification loops, and
testing with every intended model.

### Codex profile

Codex starts with skill names, descriptions, and paths, then loads full
instructions after selection. Its initial skill list uses at most 2% of model
context, or 8,000 characters when context size is unknown. Codex shortens
descriptions first and may omit skills from very large installed sets. OpenAI
therefore recommends concise descriptions with the distinguishing use case and
trigger terms front-loaded. These facts ground only the two named Codex profile
rules; they do not create new portable requirements.

## Empirical design evidence

### Procedural anchors

The Demystifying study analyzed 8,135 trial records across Terminal-Bench 2.0,
Terminal-Bench Pro, and SkillsBench. Procedural anchoring explained 65.7% of
successful skill use while explicit knowledge injection explained 4.5%.
Distilled skills beat workflow memory derived from the same trajectories, and
verbose traces caused more timeout exhaustion. This grounds
`knowledge-dump-no-procedure` and `undistilled-trajectory-content`.

The same study found large reductions in environment/infrastructure failures,
output-format mismatches, and service-lifecycle failures when skills supplied
explicit setup and verification anchors. This grounds
`verification-anchors-missing` and `brittle-context-assumptions`.

### Selection and pool collisions

In similar-distractor pools, retrieval precision declined much faster as the
skill pool grew than it did in dissimilar pools. Actual-use precision fell even
more sharply, while downstream task success remained comparatively flat. This
grounds `description-confusable-in-pool` as a selection-predictability concern;
it must not be represented as proof of task failure.

### Compactness, fallbacks, and references

SkillsBench contains 87 tasks across eight domains and 18 model-harness
configurations using paired with/without-skill trials and deterministic
verifiers. Compact and standard-length skills produced much larger average
gains than comprehensive documentation. Supplying four or more skills also
reduced gains relative to smaller relevant sets.

Thirteen SkillsBench tasks became worse with a skill. A recurring mechanism was
a single mandatory pipeline applied outside its useful context, displacing a
stronger default or delegating to an opaque solver. This grounds
`single-pipeline-no-fallback`, but exact pipelines for fragile operations remain
appropriate.

The component-ablation study ran 7,560 trials. Always-prepended reference notes
were its most harmful component, and single-shot generated skills did not
significantly beat a no-skill baseline or a token-matched irrelevant placebo.
This grounds progressive disclosure and the narrowly triggered
`uncurated-generation-provenance` rule. It does not justify assuming that any
LLM-assisted skill is uncurated.

## Interpretation boundaries

- Study-level associations inform design review; they do not prove that an
  individual skill succeeds or fails its task.
- Vendor guidance becomes a named harness profile unless the open
  specification independently establishes the same requirement.
- Numeric thresholds are screening signals. Inspect the content before
  recommending deletion or extraction.
- Description examples illustrate useful discovery language. They do not
  establish a requirement for quoted user phrases or a minimum character
  count.
- Behavioral validation belongs to the skill owner's acceptance or evaluation
  workflow, outside this read-only design audit.
