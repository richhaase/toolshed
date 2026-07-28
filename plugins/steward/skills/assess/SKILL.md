---
name: assess
description: >
  Independently assess an immutable software change against an approved
  Steward contract using the strongest proportionate evidence available after
  construction. Use after any inner builder or workflow finishes, including
  when evidence differs from what was anticipated. Produce claim-level
  pass/fail/inconclusive outcomes bound to exact provenance. Do not add
  criteria, reinterpret the contract, fix the build, or invent validation
  infrastructure.
---

# Assess

Assess the frozen intent delta after construction. Steward validates what was
built without owning the inner workflow that built it.

## Boundaries

- Require an approved contract and an immutable change identity.
- Assess only the frozen `AC<n>` claims. Do not introduce acceptance criteria
  retrospectively.
- Select proportionate evidence after construction. For format v3, no
  predeclared evidence method is required.
- Do not modify the implementation, contract, tests, environment, or
  assessment target.
- Never create monitoring, credentials, diagnostic identities, probes, or
  product behavior merely to avoid an inconclusive result.
- Treat approved contracts and completed assessments as immutable.

## Procedure

1. Read `../../resources/references/contract-format.md` and resolve
   `../../resources/scripts/steward` relative to this file.
2. Run `check` on the contract. Confirm `state: approved` and record its exact
   revision and frozen body hash.
3. Resolve the completed change to an immutable identity such as an exact
   40-character Git commit SHA. Record the environment/context and assessor.
4. Establish the exact diff and relevant runtime surface without changing
   them.
5. Create the assessment:

   ```bash
   node "$STEWARD_CLI" assessment path/to/ticket.md \
     --output path/to/assessment.md \
     --change-id git:0123456789abcdef0123456789abcdef01234567 \
     --environment "runtime, OS, fixtures, deployment context" \
     --assessor "Assessor identity"
   ```

6. For each frozen claim, choose the strongest proportionate evidence now
   available. Useful evidence may include:
   - targeted tests or an existing suite;
   - static inspection of the exact diff;
   - browser, API, or command observation;
   - deployment artifacts or logs; or
   - a separately recorded operator/client validation.
7. Record each command or artifact and its observed result as `E<n>`. Link it
   from the relevant claim outcome. Format-v3 evidence maps directly to claims
   and has no `EV<n>` backlink.
8. Assign each claim:
   - `pass` when observed evidence establishes it;
   - `fail` when observed evidence contradicts it; or
   - `inconclusive` when evidence is unavailable, inaccessible, conflicting,
     environment-dependent, or still awaits an external operator.
9. Derive Overall from the claim outcomes and record residual uncertainty.
10. Classify non-pass remediation as `implementation-defect`,
    `contract-defect`, or `insufficient-or-conflicting-evidence`. Use `none`
    only when all claims pass. Record a concrete next action without changing
    the frozen artifact.
11. Run `assessment-check`, resolve structural or provenance errors, then run
    `assessment-complete`. Re-run the check and report the immutable assessment
    hash.

## Judgment

- “Tests pass” is not evidence without the exact command or artifact and the
  observation relevant to a claim.
- Repository-wide suites are not automatically stronger than focused evidence.
- Unrequested improvements and unrelated defects may be recorded as
  observations, but they do not change claim outcomes.
- If the contract itself is defective, keep it frozen and route through a new
  explicitly approved revision.
