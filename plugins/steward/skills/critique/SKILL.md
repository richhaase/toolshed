---
name: critique
description: >
  Independently review a proposed Steward ticket/contract for ambiguity,
  hidden assumptions, missing cases, scope leaks, untestable acceptance claims,
  and weak evidence plans. Use when the user asks to challenge, review,
  red-team, or quality-check a software ticket before approval. Produce
  findings only; do not rewrite, approve, freeze, or implement the ticket.
---

# Critique

Challenge the proposed contract as an independent assurance role.

## Boundaries

- Review the contract artifact itself. Do not rely on the framer's private
  reasoning, builder reasoning, or unstated conversational context.
- Do not edit the ticket, approve it, or implement it.
- Do not optimize for the likely builder. The contract must remain sufficient
  for any capable builder working in the target codebase.
- Treat an approved contract as frozen. If it has a defect, recommend a new
  revision rather than changing it.

## Procedure

1. Read `../../resources/references/contract-format.md`, resolving the path
   relative to this `SKILL.md`, not the user's current directory. Resolve
   `../../resources/scripts/steward` the same way to an absolute path and refer
   to it as `STEWARD_CLI`.
2. Run:

   ```bash
   node "$STEWARD_CLI" check path/to/ticket.md
   ```

   Report structural or frozen-integrity failures first.
3. Read only the ticket and any evidence sources explicitly named in it.
4. Test each part for:
   - ambiguous terms, actors, boundaries, quantities, and failure behavior;
   - assumptions disguised as facts or requirements;
   - missing normal, edge, error, migration, compatibility, security, privacy,
     observability, and rollback cases when relevant;
   - requirements without corresponding acceptance coverage;
   - acceptance claims that are compound, subjective, circular, or untestable;
   - evidence plans that do not identify an observable artifact or procedure;
   - conflicts among intent, scope, constraints, and claims;
   - implementation prescriptions that are not genuine constraints.
5. Render a concise report:

   ```markdown
   # Contract critique

   Contract: <id>@<revision>
   Recommendation: ready-for-approval | revise

   ## Findings
   | Severity | Location | Finding | Why it matters | Suggested resolution |

   ## Unresolved assumptions
   - ...

   ## Evidence gaps
   - ...

   ## Residual uncertainty
   - ...
   ```

6. Use severities `blocker`, `major`, and `minor`. Prefer a few precise
   findings over generic advice. If no material issue is found, say so and
   still list residual uncertainty.

## Gotchas

- A structurally valid ticket can still be a poor contract.
- Do not turn preferences into blockers. Tie each finding to an observable
  ambiguity, risk, contradiction, or assessment failure.
- Do not silently resolve findings. The scope owner decides which changes enter
  the next draft.
