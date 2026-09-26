---
name: frame
description: >
  Frame software work as a short goal agreement that leaves agents room to
  adapt. Use when the user asks to frame a task, clarify success and boundaries,
  or use Steward before building. Reuse existing authorization without adding
  approval rounds, frozen revisions, or implementation prescriptions.
---

# Frame

Capture what the user wants to accomplish and the few conditions that make the
result acceptable. Leave the builder free to discover and change the approach.

Read `../../resources/references/goal-agreements.md` for the shared agreement
and adaptation rules. Framing owns intent; the builder owns planning,
implementation, and verification strategy.

## Procedure

1. Read the request and enough codebase context to understand the change. Reuse
   decisions and authorization already present in the conversation. Ask only
   about an unresolved choice that materially changes the goal, success
   conditions, or a hard boundary; ordinary engineering uncertainty belongs
   to the builder.
2. Write a short agreement using the shape below. For ordinary work, a
   paragraph and a few bullets are enough. Omit sections that add no useful
   information. Use the conversation unless the user requests a file or the
   repository has an established location.

   ```markdown
   Goal: <the result the user wants>

   Success:
   - <how to recognize that the goal was achieved>

   Boundaries: <only essential limits or endangered behavior, if any>
   ```

3. Keep only distinctions that affect whether the result is acceptable. Usually
   one to three success conditions suffice. Do not turn each interaction,
   edge case, invariant, or implementation step into a separate claim. Do not
   repeat boundaries in Success merely to make them assessable.
4. Keep implementation plans, candidate mechanisms, and test inventories out
   of the agreement. Preserve an exact mechanism, number, or wording when the
   user actually requires it; do not promote a suggestion or an example into
   a requirement. Let the builder choose proportionate evidence later.
5. Use critique when the user requests it or a concrete unresolved tradeoff
   merits an independent challenge. Touching permissions, migrations, or
   another sensitive area alone does not require a critique cycle. Several
   valid solutions are healthy latitude, not a defect to eliminate.
6. Deliver the agreement and any material question. A faithful summary of an
   already authorized request needs no new approval. If the user asked only
   for framing, finish here. If they also authorized construction, continue
   through the available construction workflow. Framing does not itself
   authorize implementation, delegation, or external actions.

When work is too broad to judge usefully, suggest a few outcome-oriented slices.
Do not split merely because a goal admits several implementation approaches.

When discoveries change what the user wants or will accept, ask for the
smallest necessary decision and update the agreement accordingly. An approach
change that still meets the agreement needs no amendment or approval cycle.
