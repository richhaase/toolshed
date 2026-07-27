---
name: assess
description: >
  Independently judge an immutable software change against an approved and
  frozen Steward Markdown contract. Use when the user asks whether a commit,
  release artifact, or other fixed revision satisfies its ticket, wants
  claim-level pass/fail/inconclusive outcomes, or needs a provenance-bound
  assurance report with remediation classification. Do not assess a mutable
  branch/worktree snapshot, use the builder's private reasoning, or fix the
  implementation.
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
- Bind the report to an exact commit SHA or equivalent immutable revision,
  environment/context, and assessor identity. A branch name, `HEAD`, PR number
  without a fixed head SHA, or "working tree" is not a change identity.

## Procedure

1. Read `../../resources/references/contract-format.md`, resolving the path
   relative to this `SKILL.md`, not the user's current directory. Resolve
   `../../resources/scripts/steward` the same way to an absolute path and refer
   to it as `STEWARD_CLI`.
2. Verify the ticket:

   ```bash
   node "$STEWARD_CLI" check path/to/ticket.md
   ```

3. Resolve the immutable change identity before collecting evidence. For Git,
   record the exact commit SHA actually inspected, not a mutable label.
4. Create a report scaffold without overwriting an existing report:

   ```bash
   node "$STEWARD_CLI" assessment path/to/ticket.md \
     --output path/to/assessment.md \
     --change-id "git:<exact-commit-sha>" \
     --environment "runtime, OS, checkout and fixture context" \
     --assessor "Assessor identity"
   ```

5. Inspect the named immutable change and repository instructions. Establish
   the exact
   diff and relevant runtime surface.
6. For each `AC<n>` claim, follow its `EV<n>` methods and relevant `P<n>`
   scenarios. Add stable assessment evidence blocks (`E<n>`) that name the
   contract `EV<n>` method, command or artifact, and observed result. Run
   proportionate, non-destructive checks when authorized.
7. Assign exactly one outcome:
   - `pass` — sufficient evidence shows the claim is satisfied.
   - `fail` — sufficient evidence shows the claim is not satisfied.
   - `inconclusive` — evidence is missing, conflicting, inaccessible, or cannot
     distinguish pass from fail.
8. Reference one or more `E<n>` entries from every pass/fail claim. Record
   residual uncertainty even for a passing claim; do not use an empty green
   checkmark as evidence.
9. Summarize overall status:
   - `pass` only if every claim passes;
   - `fail` if any claim fails;
   - `inconclusive` otherwise.
10. If status is not pass, choose the primary remediation classification and
    use the format's required next action:
    - `implementation-defect`: correct the build under the same frozen
      contract, assign a new immutable change identity, and reassess;
    - `contract-defect`: keep the approved artifact unchanged and route to a
      revised draft, critique, explicit approval, build, and assessment;
    - `insufficient-or-conflicting-evidence`: collect or reconcile evidence and
      reassess the same contract/change unless the implementation changes.
11. List contract-level observations separately from implementation findings.
    A defect in a frozen claim is not permission to reinterpret or edit it.
12. Validate and freeze the completed report:

    ```bash
    node "$STEWARD_CLI" assessment-check path/to/assessment.md
    node "$STEWARD_CLI" assessment-complete path/to/assessment.md
    node "$STEWARD_CLI" assessment-check path/to/assessment.md
    ```

    Report the contract hash, change identity, assessment hash, outcome, and
    remediation classification.

## Gotchas

- Absence of a failing test is not evidence of success.
- A builder's explanation is a lead to verify, never proof.
- Tests can support a claim without covering it completely. State the uncovered
  behavior in residual uncertainty.
- Evidence collected from a different commit or environment does not establish
  the assessed change. Record the mismatch and use `inconclusive`.
- A contract defect requires a successor revision even when the implementation
  appears reasonable. The approved contract remains the audit record.
- An unrequested beneficial change does not compensate for a failed claim.
