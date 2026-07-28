# Steward contract format

Steward freezes the minimum decision-complete intent delta, delegates
construction to an arbitrary inner loop, and assesses the resulting immutable
change. Contracts are local Markdown files whose meaning does not depend on
their repository, issue tracker, or software builder.

## Contents

- [Lifecycle and compatibility](#lifecycle-and-compatibility)
- [Contract metadata](#contract-metadata)
- [Format-v3 body](#format-v3-body)
- [Contract CLI](#contract-cli)
- [Assessment format v3](#assessment-format-v3)
- [Legacy formats](#legacy-formats)

## Lifecycle and compatibility

Each revision is a distinct artifact:

`draft -> explicitly approved/frozen -> separately assessed`

- `draft` is editable and does not authorize construction.
- `approved` records the explicit scope owner and a SHA-256 hash of the
  normalized Markdown body. Later body changes invalidate the artifact.
- An assessment is separate from the contract and is bound to the approved
  revision plus an immutable change identity.

The approved contract defines outcomes and load-bearing boundaries. The target
codebase and its agent instructions remain the source of implementation
context. Any inner workflow may construct the change.

Format v3 is the default. Formats v1 and v2 remain readable, approvable,
comparable, and assessable under their original validation rules. Never edit or
reinterpret an approved artifact.

Use `steward create NEW --from APPROVED` for a successor in the same format.
This copies the body, increments `revision`, records `supersedes`, and clears
approval metadata. Use `--format 3` with an approved v1/v2 source to create a
blank lean successor with the same lineage. The CLI does not transform the old
body; reframing it into v3 remains a scope-owner judgment.

The legacy `migrate` command remains available only for v1-to-v2 compatibility.

## Contract metadata

The file begins with single-line YAML scalar frontmatter:

| Field | Meaning |
| --- | --- |
| `steward_contract` | `"3"` for the current format; `"1"` and `"2"` remain supported |
| `id` | Stable contract identity |
| `title` | Human-readable title |
| `revision` | Positive integer |
| `state` | `draft` or `approved` |
| `created_at` | ISO-8601 timestamp for this revision |
| `approved_at` | ISO-8601 timestamp or `null` |
| `approved_by` | Explicit approver identity or `null` |
| `frozen_body_sha256` | Normalized body hash or `null` |
| `supersedes` | Prior `<id>@<revision>` or `null` |

The CLI preserves no hidden state outside the Markdown artifacts.

## Format-v3 body

Use exactly one H1 matching `title`. Only these H2 sections are recognized, in
this order when present:

1. `Outcome` — required
2. `Context` — optional
3. `Scope` — optional
4. `Acceptance` — required
5. `Constraints` — optional
6. `Examples` — optional
7. `Open questions` — optional

Approval rejects placeholder tokens (`TODO`, `TBD`, `FIXME`, `CHANGEME`, and
angle-bracket placeholders). An Open questions section must be absent or
contain exactly `- None.` at approval.

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

There is no mandatory intent, requirement, evidence-method, or probe graph in
v3. Examples may clarify a claim when prose alone permits materially different
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
steward create PATH --id ID --title TITLE [--format 2|3]
steward create PATH --from APPROVED_PATH [--format 3]
steward migrate V1_APPROVED_PATH --output V2_DRAFT_PATH
steward check PATH [--json]
steward approve PATH --by APPROVER
steward compare OLD_PATH NEW_PATH [--json]
```

New contracts default to v3. `--format 2` exists for compatibility testing and
legacy workflows. `create --from` preserves its source format unless
`--format 3` explicitly requests a blank lean successor.

All commands operate only on caller-supplied paths. `create`, `migrate`, and
`assessment` refuse to overwrite files. `approve` and
`assessment-complete` are the only in-place mutations.

`check` reports `STRUCTURALLY OK`, never semantic completeness. JSON output
includes `structurally_valid`, a compatibility `valid` alias, errors, warnings,
body words, and acceptance-claim count.

`compare` reports lifecycle metadata, changed sections, and word/claim deltas.
Growth is visible but does not automatically block approval.

## Assessment format v3

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

The body contains these H2 sections in order: `Provenance`, `Overall`, `Claim
outcomes`, `Evidence log`, `Contract observations`, `Residual risks`, and
`Remediation`.

Each frozen acceptance claim has one H3 block:

```markdown
### AC1: A rejected delivery displays the supplied failure reason.
- Outcome: pass
- Evidence: E1
- Residual uncertainty: Production localization was not sampled.
```

Evidence is selected after construction:

```markdown
### E1
- Command or artifact: `node --test test/delivery.test.js` at git:012345...
- Observation: The rejection displayed "Address rejected" and the test exited 0.
```

Evidence may be a targeted test, existing suite, static inspection, browser or
API observation, deployment artifact, log, or separately recorded
operator/client validation. V3 does not require a predeclared contract
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

A non-pass v3 assessment records a concrete next action. The contract remains
frozen. `assessment-complete` validates provenance and claim evidence, then
freezes the report body.

V3 contracts use v3 assessments. Format-v2 contracts continue using v2
assessments so their frozen EV methods remain enforced. A v2 contract must be
deliberately reframed and approved as a v3 successor before using v3
post-build evidence. Format-v1 contracts use v3 assessment because their legacy
assessment format lacks immutable provenance.

## Legacy formats

### Contract v2

V2 requires exactly these H2 sections:

`Intent`, `Context`, `Scope`, `Requirements`, `Acceptance claims`, `Evidence
plan`, `Intent probes`, `Constraints`, `Assumptions and risks`, and `Open
questions`.

It enforces `I<n> -> R<n> -> AC<n> -> EV<n>` links, mandatory normal,
boundary/failure, and accepted-tradeoff `P<n>` probes, and structured `U<n>`
unknowns. Those rules remain unchanged for existing artifacts but are not the
v3 default.

### Contract v1

V1 retains its original nine-section body, one evidence-plan row per acceptance
claim, and no approved open questions. `migrate` creates a review-required v2
successor and leaves v1 untouched.

### Assessments v1 and v2

Assessment v1 remains readable with a warning and cannot be completed because
it lacks immutable provenance. Assessment v2 remains readable and completable
under its original rules: each pass/fail claim must reference observed `E<n>`
evidence tied to a contract `EV<n>` method. V3 removes only that predeclared
method linkage; it does not weaken frozen v2 artifacts.
