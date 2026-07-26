---
name: assess
description: >
  Independently judge a completed pull request, commit range, patch, or local
  software change against an approved and frozen Steward Markdown contract.
  Use when the user asks whether a build satisfies its ticket, wants
  claim-level pass/fail/inconclusive outcomes, or needs an evidence-backed
  assurance report with residual uncertainty. Do not use or request the
  builder's private reasoning, and do not fix the implementation.
---

# Assess

Judge observable results against the exact approved contract revision.

## Boundaries

- Require an approved ticket whose frozen body hash verifies. Stop if `check`
  reports a lifecycle or integrity error.
- Use the ticket, code change, repository state, test output, and other
  reproducible artifacts. Do not request or accept the builder's chain of
  thought, hidden scratchpad, or private reasoning as evidence.
- Do not modify the implementation or ticket. Assessment is independent from
  building.
- Evaluate only the frozen claims. Record improvements outside the contract as
  observations, not as extra pass criteria.

## Procedure

1. Read `../../resources/references/contract-format.md`, resolving the path
   relative to this `SKILL.md`, not the user's current directory. Resolve
   `../../resources/scripts/steward` the same way to an absolute path and refer
   to it as `STEWARD_CLI`.
2. Verify the ticket:

   ```bash
   node "$STEWARD_CLI" check path/to/ticket.md
   ```

3. Create a report scaffold without overwriting an existing report:

   ```bash
   node "$STEWARD_CLI" assessment path/to/ticket.md \
     --output path/to/assessment.md --change-ref "PR, range, or worktree"
   ```

4. Inspect the named change and repository instructions. Establish the exact
   diff and relevant runtime surface.
5. For each `AC<n>` claim, collect direct evidence using the contract's evidence
   plan. Run proportionate, non-destructive checks when authorized.
6. Assign exactly one outcome:
   - `pass` — sufficient evidence shows the claim is satisfied.
   - `fail` — sufficient evidence shows the claim is not satisfied.
   - `inconclusive` — evidence is missing, conflicting, inaccessible, or cannot
     distinguish pass from fail.
7. Replace each scaffold row with concise evidence: file/line references,
   command and result, test name, observed behavior, or artifact path. Record
   what uncertainty remains even for passing claims.
8. Summarize overall status:
   - `pass` only if every claim passes;
   - `fail` if any claim fails;
   - `inconclusive` otherwise.
9. List contract-level observations separately from implementation findings.
   A defect in the frozen claim is residual uncertainty, not permission to
   reinterpret it.

## Gotchas

- Absence of a failing test is not evidence of success.
- A builder's explanation is a lead to verify, never proof.
- Tests can support a claim without covering it completely. State the uncovered
  behavior in residual uncertainty.
- An unrequested beneficial change does not compensate for a failed claim.
