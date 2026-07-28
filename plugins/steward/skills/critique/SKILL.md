---
name: critique
description: >
  Independently test whether a Steward draft is decision-complete without
  expanding its requested scope. Use when material ambiguity, coupled outcomes,
  assessability risk, or a changed authorization, security, privacy, data-loss,
  migration, or compatibility boundary warrants challenge. Produce a bounded,
  convergent findings report; do not rewrite, approve, implement, or conduct a
  general design review.
---

# Critique

Challenge scope fidelity, not hypothetical completeness. The contract records
the minimum decision-complete intent delta; the codebase remains implementation
context.

## Boundaries

- Review the requested delta, not the whole surrounding system.
- Admit a finding only when a reasonable implementation could satisfy the
  current text yet violate its outcome, an acceptance claim, or a load-bearing
  boundary endangered by this change.
- Implementation preferences, speculative hardening, general best practices,
  unrelated existing defects, and evidence convenience are not blockers.
- Do not introduce a subsystem, credential, monitor, product surface,
  architecture, or follow-up feature absent from the authorized outcome.
- Treat unchanged behavior as codebase context unless the requested delta
  plausibly threatens a named invariant.
- Output only the critique report. Do not create, copy, normalize, rewrite,
  approve, freeze, or implement a contract artifact. When the contract is
  supplied inline, review it inline rather than materializing a file.

## Finding classes

- `contract-defect`: the contract needs a minimal revision.
- `builder-discretion`: the arbitrary inner loop may decide it.
- `follow-up`: valuable work outside this contract.
- `residual-uncertainty`: honestly retained without blocking construction.
- `out-of-scope`: not part of the authorized outcome.

Only `contract-defect` can produce `revise-minimally`.

## Procedure

1. Read `../../resources/references/contract-format.md` and resolve
   `../../resources/scripts/steward` relative to this file.
2. When the user supplies a contract path, run
   `node "$STEWARD_CLI" check path/to/ticket.md` and report structural or
   frozen-integrity errors before semantic findings. When the contract is
   supplied inline, inspect its structure without creating a temporary
   contract.
3. Read the contract, the originating request when available, prior critique
   findings when this is a later pass, and only enough target-codebase evidence
   to verify a claimed boundary. Do not demand that the contract repeat facts
   discoverable in the codebase.
4. A contract defect must establish at least one admissibility condition:
   - two reasonable compliant implementations produce materially different
     in-scope outcomes;
   - a plausible compliant implementation crosses a relevant authorization,
     privacy, security, data-loss, or compatibility boundary;
   - an acceptance claim cannot meaningfully receive pass/fail after
     construction; or
   - outcome, scope, constraints, and claims contradict one another.
5. Tie every defect to the exact outcome, claim, or endangered boundary it
   protects. Describe the plausible compliant-but-wrong interpretation and the
   smallest resolution.
6. Classify other concerns rather than turning them into requirements. Do not
   report an exhaustive inventory of non-blocking observations.
7. Prefer deletion, local clarification, or splitting over additional
   specification. Report at most the three highest-impact contract defects. If
   more are necessary, recommend `split`.
8. One full critique is the default. A later pass reviews changed text,
   unresolved findings, and materially new evidence only. Do not introduce a
   new concern class against unchanged text without materially new evidence.
9. Stop when remaining concerns are builder choices, follow-ups, residual
   uncertainty, or out of scope.

## Report

```markdown
# Contract critique

Contract: <id>@<revision>
Recommendation: ready | revise-minimally | split

## Contract defects
| Location | Plausible compliant-but-wrong result | Protected outcome or boundary | Minimal resolution |

## Non-blocking disposition
| Concern | Classification | Rationale |

## Residual uncertainty
- ...
```

Use `ready` when no contract defect remains. Minor wording preferences and
residual uncertainty do not force revision.
