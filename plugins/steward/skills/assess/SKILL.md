---
name: assess
description: >
  Assess whether software work achieved its Steward goal agreement using
  proportionate evidence. Use when the user asks whether work met the goal,
  satisfied its contract, or is ready for sign-off. Accept current work without
  requiring a frozen contract or commit. Report results and meaningful gaps
  without fixing the implementation or adding requirements.
---

# Assess

Judge whether the work achieved the agreed result within its boundaries.
Read `../../resources/references/goal-agreements.md` for the shared rules.
Assess independently from the builder's claims; this does not require a
separate agent or a new workflow.

## Procedure

1. Find the goal, success conditions, and hard boundaries in the agreement and
   originating request, including subsequent owner decisions. Do not require
   the user to create a contract retrospectively. If the intended result is
   genuinely missing or contradictory, ask one focused question instead of
   inventing it.
2. Inspect the relevant change and enough codebase context to understand it.
   Assess the current working tree when that is what the user supplied. Record
   what was inspected using available revision/diff information; for uncommitted
   work, identify it as the working tree and name the relevant files. Do not
   require a commit, clean checkout, hash, or report file for ordinary review.
3. Choose evidence proportionate to the result: a focused existing test,
   static inspection, runtime observation, or an available operator artifact
   may suffice. Record what was actually observed and what it establishes.
   Reuse credible evidence tied to the assessed state instead of rerunning
   checks mechanically.
4. Judge the goal, success conditions, and hard boundaries directly. Different
   architecture, sequencing, libraries, tests, or incidental UI choices are
   acceptable when the agreement leaves them open. A changed approach is not
   a defect and needs no retroactive contract revision.
5. Report `pass`, `fail`, or `inconclusive`, with concise evidence and any
   material gap. Pass requires the agreed result and boundaries to be met;
   failure requires evidence of a missed requirement or crossed boundary.
   Missing evidence is inconclusive, not an assumed failure. Overall is fail
   if a requirement is known to be violated, even if other results remain
   unverified; otherwise it is inconclusive until the result is established.
   Use a short paragraph for a small task or bullets when distinct results
   need separate treatment. Do not require claim IDs, evidence IDs, or a fixed
   report schema.

## Judgment and limits

- Reasonable interpretation connects the words to their purpose and codebase
  context. It does not waive an explicit requirement or let the builder pick a
  more convenient goal. Multiple acceptable solutions are not a reason for an
  inconclusive result.
- Qualitative goals can pass on concrete observations and explained judgment.
  Do not add arbitrary metrics, coverage targets, or evidence infrastructure.
- When evidence needs unavailable operator access, say which result remains
  unverified and give the user one concise observation request. Do not assign
  privileged work to an implementer who lacks access.
- If success genuinely depends on missing owner intent, identify the decision
  needed. The owner can clarify or change the agreement without creating a
  successor artifact. Disclose changed requirements; do not silently relabel
  an original miss as a pass. Have framing or the construction workflow record
  a changed agreement before a new assessment.
- Do not modify implementation, tests, or the agreement while assessing. Use
  non-destructive checks; ordinary ignored or temporary check output is fine.
- Do not make unrelated defects or unrequested improvements conditions of
  success. A useful observation may be reported separately without expanding
  the task.
