---
name: frame
description: >
  Turn an ordinary software request, problem statement, or conversation into a
  self-contained Steward Markdown ticket/contract. Use when the user wants to
  clarify intent, trace requirements to acceptance evidence, add representative
  intent probes, record non-blocking unknowns, draft or migrate a contract,
  compare revisions, or explicitly approve and freeze a ticket for an
  interchangeable builder. Do not implement the software described by the
  ticket.
---

# Frame

Create an implementation-independent contract that a builder can read in its
codebase without access to this conversation.

## Boundaries

- Own the outer intent loop, not construction. Do not implement the requested
  software or create builder-specific handoff instructions.
- Treat the contract file as the builder interface. Keep its content and
  lifecycle independent of storage location.
- Use only local Markdown paths. Do not introduce an issue tracker,
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
   open questions from the conversation. Separate user/business outcomes from
   implementation preferences.
4. Ask only for decisions that materially change the contract. For an unknown
   that does not block assessment, record its owner, decision deadline or
   trigger, safe default, and why the default leaves the claims assessable.
   Mark a genuinely validation-blocking question as `blocking`; do not invent
   certainty merely to make a draft approvable.
5. Create the initial file:

   ```bash
   node "$STEWARD_CLI" create path/to/ticket.md \
     --id short-ticket-id --title "Ticket title"
   ```

   For a successor in the same format:

   ```bash
   node "$STEWARD_CLI" create path/to/ticket.r2.md \
     --from path/to/ticket.r1.md
   ```

   To move an approved v1 contract to v2:

   ```bash
   node "$STEWARD_CLI" migrate path/to/ticket.r1.md \
     --output path/to/ticket.r2.md
   ```

   Migration preserves the approved source and intentionally leaves review
   markers where traceability or scenarios require human judgment.
6. Replace every placeholder and build an explicit trace chain:
   - give outcomes stable `I<n>` identifiers;
   - give requirements stable `R<n>` identifiers and reference their intent;
   - give claims stable `AC<n>` identifiers and directly reference both intent
     and requirement ids;
   - give evidence methods stable `EV<n>` identifiers and reference the claims
     they can establish.
   Preserve stable ids across revisions; do not renumber unaffected entries.
7. Add a small representative probe set with stable `P<n>` ids: at least one
   normal scenario, one boundary or failure scenario, and one explicitly
   accepted tradeoff. Each probe references relevant claims and evidence
   methods. Prefer three to seven discriminating user-observable scenarios over
   an exhaustive edge-case catalog.
8. Run `check`. Resolve every structural, traceability, probe, and unknown
   error before offering the ticket for approval.
9. Recommend an independent `critique` pass. Incorporate accepted findings in
   the draft and re-run `check`.
10. Present the exact path, revision, traceability summary, remaining
    assumptions/risks, non-blocking unknowns, and any blocking questions. Ask
    for explicit approval of that revision only when no blocking question
    remains.
11. After explicit approval only, freeze it:

    ```bash
    node "$STEWARD_CLI" approve path/to/ticket.md --by "Approver"
    ```

12. Re-run `check` and report the frozen body hash. The builder needs only the
    approved ticket path and its codebase.

## Gotchas

- Approval freezes the normalized body, not a private conversation or the
  framer's reasoning. If a needed fact is absent from the file, it is absent
  from the contract.
- Evidence must say how an assessor can observe the claim. "Works correctly,"
  "tests pass," and other circular claims are not evidence plans.
- Keep claims separable. A claim that bundles unrelated outcomes is difficult
  to assess and should usually be split.
- Probes are intent checks, not a duplicate test suite. A boundary/failure
  probe should illuminate an important decision, and an accepted-tradeoff
  probe should make a deliberate limitation visible.
- A safe default is not permission to defer a blocking decision. Its rationale
  must explain how every affected claim can still receive a meaningful
  pass/fail/inconclusive outcome.
- `check` validates structure and lifecycle invariants; it cannot prove that
  the intent is wise or complete. That is why critique remains independent.
