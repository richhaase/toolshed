---
name: frame
description: >
  Turn an ordinary software request, problem statement, or conversation into a
  self-contained Steward Markdown ticket/contract. Use when the user wants to
  clarify intent, scope, requirements, acceptance claims, evidence, assumptions,
  or risks; draft or revise a contract; check contract structure; compare
  revisions; or explicitly approve and freeze a ticket for an interchangeable
  builder. Do not implement the software described by the ticket.
---

# Frame

Create an implementation-independent contract that a builder can read in its
codebase without access to this conversation.

## Boundaries

- Own the outer intent loop, not construction. Do not implement the requested
  software or create builder-specific handoff instructions.
- Treat the contract file as the builder interface. Keep its content and
  lifecycle independent of storage location.
- Use only local Markdown paths in v1. Do not introduce an issue tracker,
  service, database, adapter, or orchestration layer.
- Never approve on the user's behalf. Only run `approve` after the user
  explicitly approves the exact revision.
- Never edit an approved revision. Derive a new draft with `create --from`.

## Procedure

1. Read `../../resources/references/contract-format.md`, resolving the path
   relative to this `SKILL.md`, not the user's current directory.
2. Resolve `../../resources/scripts/steward` the same way to an absolute path,
   refer to it as `STEWARD_CLI`, and preflight `node`.
3. Extract intent, context, in-scope and out-of-scope behavior, constraints,
   requirements, acceptance claims, evidence methods, assumptions, risks, and
   open questions from the conversation.
4. Ask only for decisions that materially change the contract. Keep unknowns
   explicit rather than silently choosing.
5. Create the initial file:

   ```bash
   node "$STEWARD_CLI" create path/to/ticket.md \
     --id short-ticket-id --title "Ticket title"
   ```

   For a successor to an approved revision:

   ```bash
   node "$STEWARD_CLI" create path/to/ticket.r2.md \
     --from path/to/ticket.r1.md
   ```

6. Replace every placeholder. Give requirements stable `R<n>` identifiers and
   acceptance claims stable `AC<n>` identifiers. Give every acceptance claim
   a concrete evidence-plan row.
7. Run `check`. Resolve every error before offering the ticket for approval.
8. Recommend an independent `critique` pass. Incorporate accepted findings in
   the draft and re-run `check`.
9. Present the exact path, revision, remaining assumptions/risks, and a concise
   summary. Ask for explicit approval of that revision.
10. After explicit approval only, freeze it:

    ```bash
    node "$STEWARD_CLI" approve path/to/ticket.md --by "Approver"
    ```

11. Re-run `check` and report the frozen body hash. The builder needs only the
    approved ticket path and its codebase.

## Gotchas

- Approval freezes the normalized body, not a private conversation or the
  framer's reasoning. If a needed fact is absent from the file, it is absent
  from the contract.
- Evidence must say how an assessor can observe the claim. "Works correctly,"
  "tests pass," and other circular claims are not evidence plans.
- Keep claims separable. A claim that bundles unrelated outcomes is difficult
  to assess and should usually be split.
- `check` validates structure and lifecycle invariants; it cannot prove that
  the intent is wise or complete. That is why critique remains independent.
