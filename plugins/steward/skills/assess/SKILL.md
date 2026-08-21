---
name: assess
description: >
  Independently assess an immutable software change against an approved
  Steward contract using the strongest proportionate evidence available after
  construction. Distinguish PR/implementation-verifiable claims from external
  operator validation and mechanism ambiguity. Use after any inner builder or
  workflow finishes, including when evidence differs from what was anticipated,
  or when the user says "assess this against the contract", "did this do what
  the ticket asked", "check this branch against its spec", or "verify the work
  before I sign off". Produce claim-level pass/fail/inconclusive outcomes
  bound to exact provenance. Do not add criteria, reinterpret the contract,
  fix the build, or invent validation infrastructure.
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
- Treat documented engineering constraints and target-repository conventions
  as relevant implementation context.
- Judge the frozen outcome, not a preferred mechanism, unless the contract
  explicitly freezes that mechanism or boundary.
- Do not modify the implementation, contract, tests, environment, or
  assessment target.
- Never create monitoring, credentials, diagnostic identities, probes, or
  product behavior merely to avoid an inconclusive result.
- A builder's rationale may inform the assessment but cannot amend or waive a
  frozen claim.
- Treat approved contracts and completed assessments as immutable.

## Procedure

1. Read `../../resources/references/contract-format.md` and resolve
   `../../resources/scripts/steward` relative to this file.
2. Run `check` on the contract. Confirm `state: approved` and record its exact
   revision and frozen body hash.
3. Resolve the completed change to an immutable identity such as an exact
   40-character Git commit SHA. Record the environment/context and assessor.
4. Establish the exact diff, relevant runtime surface, repository instructions,
   conventions, and documented engineering constraints without changing them.
5. Create the assessment:

   ```bash
   node "$STEWARD_CLI" assessment path/to/ticket.md \
     --output path/to/assessment.md \
     --change-id git:0123456789abcdef0123456789abcdef01234567 \
     --environment "runtime, OS, fixtures, deployment context" \
     --assessor "Assessor identity"
   ```

6. Classify each frozen claim's evidence responsibility and record it briefly
   in its residual uncertainty or in Contract observations:
   - `PR/implementation-verifiable` — the immutable change, repository
     evidence, or an accessible runtime can establish the result;
   - `external/operator-only` — establishing the result requires privileged
     environment access, a post-deploy observation, an operator/client action,
     or another human-only check outside the implementation surface; or
   - `mixed/ambiguous` — part is PR/implementation-verifiable, but an external
     observation or unresolved outcome-versus-mechanism interpretation remains.
7. For each frozen claim, choose the strongest proportionate evidence now
   available. Useful evidence may include:
   - targeted tests or an existing suite;
   - static inspection of the exact diff;
   - browser, API, or command observation;
   - deployment artifacts or logs; or
   - a separately recorded operator/client validation.
8. When external/operator-only evidence or mechanism ambiguity blocks a
   conclusion, surface one concise question or validation task to the current
   scope owner/user when interaction is available. Ask only for the decision
   or observation the assessor cannot obtain. Do not assign it back to the
   implementer or guess an individual owner. If it remains unanswered, retain
   it as the concrete next action.
9. Record each command or artifact and its observed result as `E<n>`. Link it
   from the relevant claim outcome. Format-v3 evidence maps directly to claims
   and has no `EV<n>` backlink.
10. Assign each claim:
   - `pass` when observed evidence establishes it;
   - `fail` when observed evidence contradicts it or demonstrates an omitted
     frozen behavior within the authorized implementation surface; or
   - `inconclusive` when evidence is unavailable, inaccessible, conflicting,
     environment-dependent, still awaits an external operator, or cannot
     resolve a material outcome-versus-mechanism ambiguity.
11. Separate implementation findings from external validation notes, using
    Contract observations or Residual risks rather than adding assessment H2
    sections. Label an unavailable human-only result “inconclusive — external
    operator validation required”; do not present it as an implementation
    failure. Overall is `fail` when any claim fails, `pass` only when every
    claim passes, and `inconclusive` otherwise.
12. Classify non-pass remediation as `implementation-defect`,
    `contract-defect`, or `insufficient-or-conflicting-evidence`. Use `none`
    only when all claims pass. External validation and unresolved mechanism
    ambiguity normally use `insufficient-or-conflicting-evidence`; a proven
    in-scope omission uses `implementation-defect`. Record a concrete next
    action without changing the frozen artifact.
13. Run `assessment-check`, resolve structural or provenance errors, then run
    `assessment-complete`. Re-run the check and report the immutable assessment
    hash.

## Judgment

- “Tests pass” is not evidence without the exact command or artifact and the
  observation relevant to a claim.
- Repository-wide suites are not automatically stronger than focused evidence.
- Do not mandate a library, transport, service, datastore, instrumentation
  path, or test type that the frozen contract does not require.
- If engineering evidence leaves multiple plausible mechanisms or meanings,
  ask the scope owner which outcome was intended and use `inconclusive` until
  evidence establishes the outcome or that answer resolves the ambiguity. Do
  not convert one preferred mechanism into a retroactive acceptance criterion.
- Engineering difficulty, missing access, or inconvenience does not waive an
  explicit frozen outcome. Contradictory evidence and genuine in-scope
  omissions still fail; a defective frozen claim requires a successor revision.
- Unrequested improvements and unrelated defects may be recorded as
  observations, but they do not change claim outcomes.
- If the contract itself is defective, keep it frozen and route through a new
  explicitly approved revision.
