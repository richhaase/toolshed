# Steward — Intent and assurance contracts

Steward is the outer intent-and-assurance loop around an interchangeable
software builder. A portable Markdown contract is the complete builder
interface:

1. `frame` turns the user's intended outcome into a traced, reviewable draft.
2. `critique` independently challenges intent coverage, probes, evidence, and
   unknowns.
3. A human explicitly approves and freezes one immutable contract revision.
4. Any builder reads that approved artifact in its codebase and builds.
5. `assess` independently judges an immutable change claim by claim, records
   reproducible evidence and provenance, and routes remediation.

Steward stores no centralized state and has no Jira or builder adapter.
Contracts and assessments are ordinary local Markdown files that may live
wherever a local path can address them.

## What format v2 adds

- Stable, reviewable trace chains from `I<n>` intent through `R<n>`
  requirements and `AC<n>` claims to `EV<n>` evidence methods.
- A small representative set of normal, boundary/failure, and explicitly
  accepted-tradeoff intent probes (`P<n>`).
- Non-blocking unknowns (`U<n>`) with an owner, decision trigger, safe default,
  and assessment rationale. Only validation-blocking questions prevent
  approval.
- Assessment reports bound to a frozen contract, immutable change identity,
  environment/context, commands or artifacts, observations, and assessor.
- Required remediation routing for implementation defects, contract defects,
  and insufficient or conflicting evidence.

The CLI continues to validate and preserve frozen format-v1 contracts. Use
`migrate` to create a review-required v2 successor without changing the v1
artifact; it never guesses missing traceability silently.

## Runtime

The bundled CLI requires Node.js and has no third-party dependencies:

```bash
node resources/scripts/steward --help
```

Typical lifecycle:

```bash
node resources/scripts/steward create ticket.r1.md \
  --id delivery-status --title "Explain failed deliveries"
node resources/scripts/steward check ticket.r1.md
node resources/scripts/steward approve ticket.r1.md --by "Scope owner"

node resources/scripts/steward assessment ticket.r1.md \
  --output assessment.md \
  --change-id git:0123456789abcdef0123456789abcdef01234567 \
  --environment "Node 24; macOS; clean checkout; synthetic fixtures" \
  --assessor "Independent assessor"
node resources/scripts/steward assessment-check assessment.md
node resources/scripts/steward assessment-complete assessment.md
```

See `resources/references/contract-format.md` for the exact portable formats,
traceability rules, migration story, provenance requirements, and remediation
actions. `examples/delivery-status.contract.md` is a complete, structurally
valid v2 draft with a non-blocking unknown.

Run the CLI tests with:

```bash
node --test tests/steward-cli.test.js
```
