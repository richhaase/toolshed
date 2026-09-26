---
name: critique
description: >
  Review a Steward goal agreement or contract for material gaps and needless
  restrictions. Use when the user asks to critique a draft, check whether a
  task is clear enough to hand off, or get a second opinion on its scope.
  Protect the intended result while preserving builder discretion. Return
  concise findings; do not rewrite, approve, or implement the task.
---

# Critique

Check whether the agreement gives a capable builder enough direction and enough
room. Read `../../resources/references/goal-agreements.md` for the shared rules.

## Review

Read the agreement, the originating request when available, and just enough
codebase context to check a concrete concern. Treat the user's explicit choices
as authoritative. Review inline content inline; do not create an artifact.

A finding must explain one of these actual problems:

- A plausible result satisfies the words but misses the user's goal or crosses
  an essential boundary.
- Missing owner intent prevents deciding whether the result is acceptable.
- Requirements contradict one another.
- The draft adds unrequested scope or fixes a choice the builder should own.

For each finding, name the affected result and the smallest useful resolution.
Prefer removing an unjustified restriction to adding another requirement. A
user-required mechanism or exact result is a real constraint; an agent's
preferred design is not.

Do not flag multiple acceptable implementations as ambiguity. The fact that
two solutions behave differently does not require the user to choose if both
meet the goal, success conditions, and boundaries. Do not require exhaustive
edge cases, predetermined evidence methods, or duplicated boundary claims.
Qualitative success can be assessed with reasoned evidence; do not invent
numerical thresholds to make it look objective.

Report only concerns worth the user's attention, usually zero to three. Use a
brief `ready` or `revise` recommendation and explain any material finding. An
agreement needing no changes can receive a one-sentence report. Separate an
optional suggestion from a blocker; no empty tables or concern taxonomy are
required. Recommend splitting only when independently valuable goals cannot
usefully be decided or assessed together.

On later passes, check the changed text and unresolved findings. Reopen an
unchanged part only when new evidence warrants it. Stop when remaining choices
belong to the builder or the result is clear enough to pursue and assess.
