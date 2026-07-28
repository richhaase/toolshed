# Steward — the outer intent and assurance loop

Steward freezes the minimum decision-complete intent delta, delegates
construction to an arbitrary inner loop, and assesses the resulting immutable
change.

It deliberately does not own planning, architecture, implementation, testing
strategy, or remediation. A builder may use any agent, bundled workflow, or
human process. The approved contract defines outcomes and load-bearing
boundaries; the target codebase remains the source of implementation context.

The lifecycle is:

1. `frame` drafts the smallest contract that distinguishes success from
   failure.
2. `critique` conditionally challenges material ambiguity or an endangered
   boundary without expanding scope.
3. A human explicitly approves and freezes one immutable revision.
4. Any inner workflow constructs the change.
5. `assess` judges the immutable result claim by claim using proportionate
   evidence selected after construction.

Steward stores no centralized state and has no Jira or builder adapter.
Contracts and assessments are ordinary local Markdown files.

## Format v3

V3 makes the outer loop cheap enough for ordinary work:

- `Outcome` and `Acceptance` are the only required body sections.
- Only `AC<n>` identifiers are mandatory.
- Context, scope, constraints, examples, and open questions are optional.
- There is no mandatory intent/requirement/evidence/probe graph.
- Evidence is chosen after construction rather than predicted during framing.
- Critique is risk-triggered, bounded to three contract defects, and converges
  on later delta-only passes.
- Structural checks report their limited guarantee honestly and expose
  nonblocking size/growth signals.

Formats v1 and v2 remain valid under their original rules. Format-v2 contracts
continue using EV-linked v2 assessments; deliberately reframe and approve a
lean v3 successor before adopting post-build v3 evidence.

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

See `resources/references/contract-format.md` for the exact portable formats
and compatibility rules. `examples/delivery-status.contract.md` is a complete
v3 example.

Run deterministic lifecycle tests with:

```bash
node --test tests/steward-cli.test.js
```

Behavioral framing, critique, convergence, and assessment cases live in
`evals/evals.json`.
