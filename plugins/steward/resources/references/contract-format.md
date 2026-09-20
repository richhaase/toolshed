# Steward contract format

Steward freezes the minimum decision-complete intent delta, delegates
construction to an arbitrary inner loop, and assesses the resulting immutable
change. Contracts are local Markdown files whose meaning does not depend on
their repository, issue tracker, or software builder.

## Contents

- [Lifecycle](#lifecycle)
- [Contract metadata](#contract-metadata)
- [Contract body](#contract-body)
- [Contract CLI](#contract-cli)
- [Assessment format](#assessment-format)

## Lifecycle

Each revision is a distinct artifact:

`draft -> explicitly approved/frozen -> separately assessed`

- `draft` is editable and does not authorize construction.
- `approved` records the supplied scope-owner identity and a SHA-256 hash of
  the normalized Markdown body. Later body changes invalidate the artifact.
- An assessment is separate from the contract and is bound to the approved
  revision plus an immutable change identity.

The approved contract defines outcomes and load-bearing boundaries. The target
codebase and its agent instructions remain the source of implementation
context. Any inner workflow may construct the change.

Never edit or reinterpret an approved artifact. Use
`steward create NEW --from APPROVED` for a successor. This copies the body,
increments `revision`, records `supersedes`, and clears approval metadata.

“Frozen” means integrity-checked and treated as immutable by the workflow. The
CLI does not change filesystem permissions, prevent manual edits, or
authenticate the person named in approval metadata. The Frame workflow must
obtain explicit human approval before invoking `approve`.

## Contract metadata

The file begins with single-line YAML scalar frontmatter:

| Field | Meaning |
| --- | --- |
| `id` | Stable contract identity |
| `title` | Human-readable title |
| `revision` | Positive integer |
| `state` | `draft` or `approved` |
| `created_at` | ISO-8601 timestamp for this revision |
| `approved_at` | ISO-8601 timestamp or `null` |
| `approved_by` | Supplied approver label or `null` |
| `frozen_body_sha256` | Normalized body hash or `null` |
| `supersedes` | Prior `<id>@<revision>` or `null` |

The CLI preserves no hidden state outside the Markdown artifacts.

## Contract body

Use exactly one H1 matching `title`. Only these H2 sections are recognized, in
this order when present:

1. `Outcome` — required
2. `Context` — optional
3. `Scope` — optional
4. `Acceptance` — required
5. `Constraints` — optional
6. `Examples` — optional
7. `Open questions` — optional

Approval rejects the explicit placeholder tokens `TODO`, `TBD`, `FIXME`, and
`CHANGEME`. An Open questions section must be absent or contain exactly
`- None.` at approval. Ordinary technical notation, including HTML tags and
generic type syntax, is content rather than a placeholder.

### Outcome

State one concise user or business result. Describe the authorized change, not
the construction process.

```markdown
## Outcome

Dispatchers can identify why a delivery failed without reading server logs.
```

### Context

Include this section only for facts unavailable from the target codebase or its
instructions that materially affect the requested outcome. Do not copy
architecture, repository conventions, API inventories, or implementation
plans.

### Scope

Use Scope only when it prevents a materially different interpretation. It may
name:

- the behavior being changed;
- an existing invariant plausibly endangered by that change; or
- important adjacent work explicitly excluded.

Suggested H3 headings are `Change`, `Preserve`, and `Not in scope`, but the CLI
does not require empty ceremony.

### Acceptance

Give each independently assessable outcome a stable `AC<n>` identifier:

```markdown
## Acceptance

- AC1: A rejected delivery displays the supplied failure reason.
- AC2: If no safe reason is available, the delivery displays the existing safe fallback.
```

Preserve stable ids across revisions and do not renumber unaffected claims.
Claims describe observable results. They do not prescribe components, tests,
evidence methods, or internal call sequences.

If violating a boundary named in Scope or Constraints would make delivery
unacceptable, represent that failure in an acceptance claim. Optional sections
clarify the frozen claims but are not an independent set of scored outcomes.

There is no mandatory intent, requirement, evidence-method, or probe graph.
Examples may clarify a claim when prose alone permits materially different
interpretations; they are not a scenario inventory.

### Constraints

Record only genuine non-negotiable boundaries. Implementation preferences and
ordinary repository conventions remain builder discretion.

### Open questions

A material unresolved decision means the contract is not decision-complete and
therefore cannot be approved. Resolve it with the scope owner. A nonmaterial
uncertainty belongs to builder discretion, a stated constraint/default,
follow-up work, or assessment residual uncertainty—not contract bureaucracy.

### Complexity guidance

`check` reports body-word and claim counts. More than roughly eight claims or
1,200 words produces a nonblocking warning. The numbers are signals, not
semantic validity rules. First remove implementation detail; if independently
valuable outcomes remain coupled, split them into smaller contracts.

## Contract CLI

```text
steward create PATH --id ID --title TITLE
steward create PATH --from APPROVED_PATH
steward check PATH [--json]
steward approve PATH --by APPROVER
steward compare OLD_PATH NEW_PATH [--json]
```

Commands write only caller-supplied artifact paths. `create` and `assessment`
refuse to overwrite files; `approve` and `assessment-complete` are the only
in-place mutations. Assessment validation also reads the contract referenced by
the assessment's `contract_path` metadata.

`check` reports `STRUCTURALLY OK`, never semantic completeness. JSON output
includes equivalent `structurally_valid` and `valid` booleans, errors, warnings,
body words, and acceptance-claim count.

`compare` requires valid contracts with the same id and reports lifecycle
metadata, changed sections, and word/claim deltas. It reports whether revision
increased but does not enforce succession or block approval.

## Assessment format

Create a provenance-bound scaffold only after the change has an immutable
identity:

```text
steward assessment CONTRACT_PATH --output PATH \
  --change-id git:0123456789abcdef0123456789abcdef01234567 \
  --environment "Node 24; macOS; clean checkout; synthetic fixtures" \
  --assessor "Alex Example"
steward assessment-check PATH [--json]
steward assessment-complete PATH
```

`--change-id` uses `TYPE:IMMUTABLE_VALUE`. Git identities require an exact
40- or 64-character commit SHA; branches, `HEAD`, tags, and working-tree
descriptions are not immutable evidence.

Assessment metadata binds:

- contract id, revision, path, and frozen body hash;
- immutable change identity;
- environment/context;
- assessor identity;
- creation/completion timestamps; and
- a frozen completed-assessment body hash.

The assessment begins with single-line YAML scalar frontmatter:

| Field | Meaning |
| --- | --- |
| `contract_path` | Contract path relative to the assessment, or an absolute path |
| `contract_id` | Exact frozen contract id |
| `contract_revision` | Exact frozen contract revision |
| `contract_body_sha256` | Exact frozen contract body hash |
| `change_identity` | Declared immutable `TYPE:VALUE` identity for the assessed change |
| `environment` | Single-line runtime and evidence context |
| `assessor` | Supplied assessor identity |
| `created_at` | ISO-8601 timestamp |
| `completed_at` | ISO-8601 timestamp or `null` |
| `state` | `draft` or `completed` |
| `assessment_body_sha256` | Completed body hash or `null` |

The CLI validates identity shape and artifact linkage. It does not prove that a
Git SHA exists, authenticate the assessor, execute evidence, or establish that
an observation is true. The assessor owns those factual checks.

The body has exactly one H1 beginning `Assessment:` and these H2 sections in
order: `Provenance`, `Overall`, `Claim outcomes`, `Evidence log`, `Contract
observations`, `Residual risks`, and `Remediation`.

Each frozen acceptance claim has one H3 block:

```markdown
### AC1: A rejected delivery displays the supplied failure reason.
- Outcome: pass
- Evidence: E1
- Residual uncertainty: Production localization was not sampled.
```

Every claim block requires `Outcome`, `Evidence`, and nonempty
`Residual uncertainty` fields. Its heading must reproduce the frozen claim
text exactly.

Evidence is selected after construction:

```markdown
### E1
- Command or artifact: `node --test test/delivery.test.js` at git:012345...
- Observation: The rejection displayed "Address rejected" and the test exited 0.
```

Evidence may be a targeted test, existing suite, static inspection, browser or
API observation, deployment artifact, log, or separately recorded
operator/client validation. Steward does not require a predeclared contract
evidence method.

Outcomes are `pass`, `fail`, or `inconclusive`. A completed assessment cannot
claim pass or fail without referenced evidence containing an observed command
or artifact. Use inconclusive when evidence is unavailable, inaccessible,
conflicting, environment-dependent, or awaits an external operator. Do not
invent validation infrastructure to avoid an inconclusive result.

Overall is pass only when every claim passes, fail when any claim fails, and
inconclusive otherwise. Remediation is:

- `none` when all claims pass;
- `implementation-defect` when construction violates the frozen contract;
- `contract-defect` when the frozen intent itself is defective; or
- `insufficient-or-conflicting-evidence` when the result cannot be established.

A non-pass assessment records a concrete next action. The contract remains
frozen. `assessment-complete` validates structural provenance, claim-to-evidence
links, and required observations, then freezes the report body. It does not
verify the truth or sufficiency of the evidence text.
