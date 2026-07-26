# Steward contract format v1

Steward contracts are local Markdown files. Their meaning does not depend on
the path, repository, or software builder.

## Lifecycle

Each revision is a distinct artifact.

`draft -> approved/frozen -> assessed`

- `draft`: editable and not authorized for construction.
- `approved`: explicitly authorized. The CLI stores a SHA-256 hash of the
  normalized Markdown body and rejects later body changes.
- `assessed`: represented by a separate assessment file; the approved ticket
  remains unchanged.

To change an approved ticket, use `steward create NEW --from APPROVED`. This
copies the body into a new draft, increments `revision`, records
`supersedes`, and clears approval metadata. Compare the two files before
approving the successor.

## Required metadata

The file begins with YAML frontmatter using these fields:

| Field | Meaning |
| --- | --- |
| `steward_contract` | Format version; exactly `"1"` |
| `id` | Stable contract identity |
| `title` | Human-readable title |
| `revision` | Positive integer, increasing across revisions |
| `state` | `draft` or `approved` |
| `created_at` | ISO-8601 timestamp for this revision |
| `approved_at` | ISO-8601 timestamp or `null` |
| `approved_by` | Explicit approver identity or `null` |
| `frozen_body_sha256` | Body hash or `null` |
| `supersedes` | Prior `<id>@<revision>` or `null` |

The v1 CLI accepts only single-line scalar metadata. It preserves no hidden
state outside the Markdown file.

## Required body

Use exactly one H1 matching `title`, then these H2 sections in order:

1. `Intent`
2. `Context`
3. `Scope`, with `In scope` and `Out of scope` H3 subsections
4. `Requirements`, with unique `- R<n>: ...` rows
5. `Acceptance claims`, with unique `- AC<n>: ...` rows
6. `Evidence plan`, with exactly one `- AC<n>: ...` row per claim
7. `Constraints`
8. `Assumptions and risks`, with `Assumptions` and `Risks` H3 subsections
9. `Open questions`

Use `- None.` where an optional list has no entries. Approval refuses
placeholder tokens (`TODO`, `TBD`, `FIXME`, `CHANGEME`, or angle-bracket
placeholders) and requires open questions to be `- None.`.

## CLI

The role skills resolve `../../resources/scripts/steward` relative to their
own `SKILL.md` location, not the user's current directory:

```text
steward create PATH --id ID --title TITLE
steward create PATH --from APPROVED_PATH
steward check PATH [--json]
steward approve PATH --by APPROVER
steward compare OLD_PATH NEW_PATH [--json]
steward assessment CONTRACT_PATH --output PATH [--change-ref REF]
```

All commands operate only on paths supplied by the caller. `create` and
`assessment` refuse to overwrite existing files. `approve` is the only
in-place mutation. `compare` reports lifecycle metadata and exact before/after
content for every changed section; `--json` emits the same data structurally.

## Assessment format

An assessment is a separate Markdown artifact with
`steward_assessment: "1"` metadata. It identifies the exact contract id,
revision, and frozen hash, then records one row per acceptance claim:

| Claim | Outcome | Evidence | Residual uncertainty |
| --- | --- | --- | --- |
| `AC1` | `pass`, `fail`, or `inconclusive` | Reproducible observations | What remains unknown |

The scaffold starts every claim as `inconclusive`; evidence must earn a pass or
fail. Overall status is `pass` only when every claim passes, `fail` when any
claim fails, and `inconclusive` otherwise.
