---
name: align
description: >
  Keep software work aligned with the user's intent as discoveries and feedback
  change the work. Use when the user asks to align or rethink a task, when the
  agent's direction appears to drift, or when a discovery creates a consequential
  choice about the result, scope, or cost. Clarify what matters, recommend a
  direction, and carry user decisions forward without creating a specification
  or an approval ritual.
---

# Align

Help the agent keep solving the problem the user cares about. The useful output
is a shared understanding and a sensible next move, not a document to satisfy.

## Find the current intent

Read the relevant conversation and enough of the current work to understand
what the user wants and what has changed. Distinguish explicit user choices
from the agent's assumptions, suggestions, and implementation plans. Later
user corrections replace earlier assumptions; changing an agent's own plan
does not require the user to approve it again.

At the start of a task, clarify only what is missing and consequential. During
work, focus on the discovery or feedback that could change the direction. A
clear request already gives the agent something to work toward; do not rewrite
it into an agreement or enumerate acceptance conditions.

## Decide whether the user needs to weigh in

- If the discovery changes only how to achieve the intended result, use
  engineering judgment and continue within the existing authorization.
- If the agent has misunderstood the request, correct that understanding and
  direction. Do not turn its mistaken assumption into a user requirement.
- If reasonable directions would serve the user differently, explain the
  consequence and recommend one. Ask one focused question when the choice
  depends on a user priority that is not known or delegated.
- If the direction would relax an explicit requirement, add material scope,
  or impose a new meaningful cost, surface that choice before pursuing it.
  Continue unaffected authorized work while awaiting the answer.

Look for emerging overbuilding as well as missed intent. A proposed capability,
abstraction, dependency, or operational process should have a reason in the
current need or codebase. If it came from the agent's speculative plan, trim
that plan; do not ask the user to approve every engineering simplification.
Existing implementation changes still follow the construction workflow and
the user's authorization.

## Make the check-in useful

Explain what was learned, why it matters to the user, and the recommended next
move. Ask only for the unresolved decision. When the direction is sound, say
so briefly and continue; routine engineering discoveries do not need a
checkpoint. There is no prescribed cadence or report shape.

Carry the answer into subsequent work, replacing outdated assumptions. Use the
conversation by default; update an existing working note when it helps a long
task or handoff, or when requested. Do not create a required artifact, decision
ledger, or separate amendment step. Respect a request only to discuss or advise.

Steward does not support its former contract formats. Do not interpret, import,
convert, or validate an old Steward contract. If that is the only supplied
intent, ask for the current goal and relevant user choices in ordinary language.
