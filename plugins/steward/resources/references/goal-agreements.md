# Steward goal agreements

Steward helps a user and a builder agree on the desired result while leaving
room to discover how to get there. Agreements live in the conversation or
ordinary Markdown. They need no CLI, frontmatter, claim IDs, approval ceremony,
or frozen revision.

## What belongs in an agreement

- **Goal:** the useful result the user wants.
- **Success:** the few conditions that distinguish achieving that goal from
  missing it. Usually one to three are enough; qualitative conditions are fine
  when observable behavior supports a reasoned judgment.
- **Boundaries, when needed:** explicit limits and existing behavior plausibly
  endangered by this change. Record each once; boundaries count directly in
  assessment and need not be duplicated as success conditions.

Match the detail to the decision. A copy edit can be one sentence. A larger
change may need a short paragraph and several bullets. These are size cues,
not quotas or validation gates. Do not turn the agreement into an inventory of
the system or everything that might go wrong.

Implementation plans and engineering notes live outside the agreement. Do not
fix a module, sequence, storage representation, design sketch, exact label,
or test method unless it is genuinely part of the user's requirement. Examples
illustrate acceptable results unless the user makes them exact requirements.
Preserve explicit user constraints even when they limit engineering choices.

## Authority and adaptation

An agreement summarizes authority already provided; it does not manufacture
authority. A clear request to do work is sufficient to proceed with that work.
Do not ask the user to approve a faithful restatement. A request only to draft,
discuss, or assess does not authorize construction or external actions. Honor
explicit user or repository approval requirements without adding Steward's own.

The builder may revise the approach, change implementation details, and choose
verification methods without returning to the user when the agreed goal,
success conditions, and hard boundaries remain satisfied. Unknown engineering
details and multiple acceptable solutions are normal. Explain significant
discoveries in ordinary progress updates when useful; no adaptation ledger or
contract amendment is required.

Return to the user when new information requires changing the goal, relaxing
success conditions or a hard boundary, adding material scope, or choosing a
material product tradeoff the user has not delegated. State the discovery and
the smallest decision needed. Continue unaffected authorized work. User
clarifications and authorized goal changes can update the agreement in place,
with a brief explanation of what changed; no successor artifact or fresh
freeze is required. Do not treat silence as authorization for a change.

## Example

Goal: People returning from employee details can resume their list work.

Success:
- Browser Back restores their search, filters, and sort selection.

Boundaries: Employee-detail links still open directly. Existing access controls
remain effective.

URL state, cached state, or another suitable approach are builder choices.
Choosing one after code inspection needs no owner decision. Dropping filter
restoration or weakening access controls changes the agreement and does.
