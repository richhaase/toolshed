---
name: check
description: >
  Check whether software work solves the user's current problem and whether
  its scope and complexity are justified. Use when the user asks if work is
  done, achieved the goal, drifted, or became overbuilt. Inspect the actual
  result with proportionate evidence and identify meaningful gaps or excess.
  No prior Steward document is needed. This is a goal and proportionality
  review, not a general code audit or an implementation task.
---

# Check

Answer two questions: does the work accomplish what the user currently wants,
and does the solution make sense for that need? A working feature can still
carry unnecessary scope or maintenance cost. A small change can still miss
the problem.

## Understand and inspect

Read the current request, relevant conversation and user decisions, and the
actual work. Distinguish user requirements from the agent's initial plan or
assumptions. Use codebase context to understand existing behavior, constraints,
and conventions. Do not manufacture a specification before reviewing.

Inspect the supplied state, including uncommitted work. Say what was checked
using available revision or file information. Choose proportionate evidence:
focused tests, static inspection, runtime observations, or existing artifacts.
Reuse credible evidence that applies to that state. Describe observations;
the builder's confidence or a generic claim that tests pass is insufficient.

## Check the useful result and the cost of the solution

Trace the user's actual task through the result. Explain what works, what is
missing or wrong, and what the evidence cannot establish. Include explicit
limits the user gave and behavior the change actually endangers. Qualitative
goals can be judged through concrete observations without invented thresholds.

Inspect the additions and complexity against their purpose. Pay attention to
extra capabilities, generalized frameworks, dependencies, configuration, public
interfaces, storage, background work, and operational obligations when present.
These are places to look, not categories that automatically make work excessive.

An excess finding needs a concrete addition, its cost, and why the current goal
or codebase does not justify it. Identify the simpler direction that could
preserve the useful result. Consider actual scale, reliability needs, existing
architecture, and maintainability before concluding that something is overbuilt.
Line counts, file counts, useful tests, ordinary error handling, and a different
implementation than first proposed are not evidence of excess by themselves.

Do not add hypothetical future needs to excuse complexity, or recommend a
redesign based only on personal taste. This review is about the changed work's
fitness for the user's need; unrelated cleanup is outside it.

## Explain where the work stands

Give a plain-language conclusion supported by the observations: what solves
the problem, any meaningful gap or unjustified cost, and the smallest useful
next step. Keep goal fulfillment and excess distinguishable; do not describe
work as ready merely because the happy path works. There are no mandatory
verdict labels, scored claims, evidence IDs, or report sections.

Treat missing evidence as uncertainty and demonstrated violations as actual
problems. When an unavailable operator observation matters, state what needs
checking without inventing infrastructure or assigning access the builder
does not have. If current intent is unclear, ask only for the missing user
decision; do not select a convenient interpretation to make the work look done.

Check is read-only: do not modify the implementation, tests, or task notes.
Non-destructive checks may create ordinary ignored or temporary output. Report
recommended changes for the construction workflow; a review does not authorize
removing features or relaxing the user's requirements.

Steward does not support its former contract formats. Do not interpret, import,
convert, or validate an old Steward contract. Work from the current goal and
user choices; ask for those if the old contract is the only supplied intent.
