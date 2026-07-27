# Steward contract format

Steward contracts are local Markdown files. Their meaning does not depend on
their path, repository, issue tracker, or software builder.

## Lifecycle and compatibility

Each revision is a distinct artifact:

`draft -> approved/frozen -> separately assessed`

- `draft` is editable and does not authorize construction.
- `approved` is explicitly authorized. The CLI stores a SHA-256 hash of the
  normalized Markdown body and rejects later body changes.
- An assessment is a separate artifact bound to the approved revision and an
  immutable change identity. The approved contract remains unchanged.

Format v2 is the current format. The CLI still validates and preserves approved
format-v1 contracts and can derive further v1 revisions with `create --from`.
It does not reinterpret v1 under v2 rules.

To adopt v2 from an approved v1 artifact, run:

```text
steward migrate ticket.r1.md --output ticket.r2.md
```

Migration leaves v1 untouched and creates a v2 successor draft. It carries
forward the old content, adds provisional trace links and representative probe
slots, and inserts `MIGRATION TODO` markers wherever human judgment is
required. Review those mappings and probes before approval. This deliberately
avoids silently guessing intent.

For any other approved revision, use `steward create NEW --from APPROVED`.
This copies the body into a new draft, increments `revision`, records
`supersedes`, and clears approval metadata. Never edit an approved artifact.

## Contract metadata

The file begins with single-line YAML scalar frontmatter:

| Field | Meaning |
| --- | --- |
| `steward_contract` | `"2"` for the current format; `"1"` remains supported |
| `id` | Stable contract identity |
| `title` | Human-readable title |
| `revision` | Positive integer, increasing across approved revisions |
| `state` | `draft` or `approved` |
| `created_at` | ISO-8601 timestamp for this revision |
| `approved_at` | ISO-8601 timestamp or `null` |
| `approved_by` | Explicit approver identity or `null` |
| `frozen_body_sha256` | Normalized body hash or `null` |
| `supersedes` | Prior `<id>@<revision>` or `null` |

The CLI preserves no hidden state outside the Markdown artifacts.

## Format-v2 body

Use exactly one H1 matching `title`, then these H2 sections in order:

1. `Intent`
2. `Context`
3. `Scope`, with `In scope` and `Out of scope` H3 subsections
4. `Requirements`
5. `Acceptance claims`
6. `Evidence plan`
7. `Intent probes`
8. `Constraints`
9. `Assumptions and risks`, with `Assumptions` and `Risks` H3 subsections
10. `Open questions`

Optional lists may use `- None.`. Approval rejects placeholder tokens (`TODO`,
`TBD`, `FIXME`, `CHANGEME`, and angle-bracket placeholders).

### Traceability rows

Identifiers remain stable when wording moves across revisions. Do not renumber
unaffected entries merely to close gaps.

```markdown
## Intent

- I1: Dispatchers can identify a failed delivery without reading server logs.

## Requirements

- R1 [I1]: A failed delivery exposes a user-visible failure reason.

## Acceptance claims

- AC1 [I1; R1]: A rejected delivery shows its failure reason to the dispatcher.

## Evidence plan

- EV1 [AC1]: Trigger a synthetic rejection and capture the displayed status.
```

References inside brackets are separated by semicolons (commas and whitespace
are also accepted). Every intent must reach a requirement, every requirement
must reach at least one acceptance claim, and every claim must have at least
one evidence method. A claim directly names both its intent and requirement
links so the mapping is reviewable without inference.

### Representative intent probes

Probes are small, user-observable scenarios that test whether the structured
claims still express the intended experience:

```markdown
- P1 [normal; AC1; EV1]: Given a routine rejection, the dispatcher sees the supplied reason.
- P2 [failure; AC1; EV1]: Given an unreadable reason, the dispatcher sees a safe fallback.
- P3 [accepted-tradeoff; AC1; EV1]: The first release may omit reason localization; raw safe text remains visible.
```

Include at least one `normal`, one `boundary` or `failure`, and one
`accepted-tradeoff` probe. Each probe names relevant `AC<n>` and `EV<n>`
identifiers, and every referenced evidence method must actually cover the
probe's claim. Usually three to seven representative probes are enough. Do not
turn the section into an exhaustive edge-case inventory.

### Open questions and non-blocking unknowns

Use `- None.` when no meaningful unknown remains. Otherwise give each unknown
a stable H3 block:

```markdown
### U1: Which localized wording should replace the safe fallback?
- Status: non-blocking
- Owner: Content design
- Decision deadline or trigger: Before localization launch
- Safe default: Use the approved English fallback
- Assessment rationale: AC1 and P2 define observable behavior under the default
```

`Status` is `non-blocking` or `blocking`. Every unknown needs an owner,
decision deadline or trigger, safe default, and rationale explaining why
assessment can proceed. Structural checks permit either status in a draft.
Approval rejects only `blocking` unknowns; a fully specified `non-blocking`
unknown may remain. This records uncertainty without forcing false certainty.

## Contract CLI

```text
steward create PATH --id ID --title TITLE
steward create PATH --from APPROVED_PATH
steward migrate V1_APPROVED_PATH --output V2_DRAFT_PATH
steward check PATH [--json]
steward approve PATH --by APPROVER
steward compare OLD_PATH NEW_PATH [--json]
```

All commands operate only on caller-supplied paths. `create`, `migrate`, and
`assessment` refuse to overwrite files. `approve` and `assessment-complete`
are the only in-place mutations. `compare` reports lifecycle metadata and
exact before/after content for each changed section.

## Assessment format v2

Create a provenance-bound scaffold only after the change has an immutable
identity:

```text
steward assessment CONTRACT_PATH --output PATH \
  --change-id git:0123456789abcdef0123456789abcdef01234567 \
  --environment "Node 24.4.0; macOS; clean checkout; synthetic fixtures" \
  --assessor "Alex Example"
steward assessment-check PATH [--json]
steward assessment-complete PATH
```

`--change-id` uses `TYPE:IMMUTABLE_VALUE`. For `git:`, the CLI requires an
exact 40- or 64-character commit SHA and rejects branch names, `HEAD`, and
working-tree descriptions. Other revision systems may use identities such as
`svn:1842` or a content digest scheme.

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

Each acceptance claim has an H3 block:

```markdown
### AC1: A rejected delivery shows its failure reason to the dispatcher.
- Outcome: pass
- Evidence: E1
- Residual uncertainty: Localization is assessed separately under U1's safe default.
```

Evidence entries record what the assessor actually observed:

```markdown
### E1
- Contract method: EV1
- Command or artifact: `node --test test/delivery.test.js` at git:012345...
- Observation: The synthetic rejection rendered "Address rejected" and the test exited 0.
```

Outcomes are `pass`, `fail`, or `inconclusive`. A completed assessment cannot
claim `pass` or `fail` without one or more referenced `E<n>` entries containing
the applicable contract `EV<n>` method, a command/artifact, and an observation.
The evidence method must cover that claim. Overall status is `pass` only when
every claim passes, `fail` when any claim fails, and `inconclusive` otherwise.
`assessment-complete` enforces these rules and freezes the report body.

When overall status is not `pass`, choose one remediation classification and
use its required next action:

| Classification | Required next action |
| --- | --- |
| `implementation-defect` | Correct the implementation against the same frozen contract, assign a new immutable change identity, and reassess. |
| `contract-defect` | Keep the approved contract immutable; derive a successor draft, critique and explicitly approve it, then build and assess that revision. |
| `insufficient-or-conflicting-evidence` | Collect or reconcile evidence and reassess the same frozen contract/change unless the implementation changes. |

An all-pass assessment uses classification `none` and next action `None.`.
Legacy assessment-v1 files remain readable by `assessment-check`, which emits
a warning; they cannot be promoted to completed v2 reports because they lack
the required provenance. Regenerate a v2 scaffold instead.
