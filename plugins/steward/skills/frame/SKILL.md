---
name: frame
description: >
  Turn an ordinary software request into the smallest Steward Markdown
  contract that can distinguish success from failure. Use before construction
  for work of any size, including small fixes, refactors, features, migrations,
  or broad requests that may need splitting. Use when the user says "frame this
  as a contract", "write up what we are actually building", "what does done
  look like here", "freeze the scope before I start", or "turn this request
  into something I can approve". Add ceremony only for a material product
  decision, load-bearing boundary, or preserved invariant. Draft and freeze
  intent; do not plan or implement the change.
---

# Frame

Steward freezes the minimum decision-complete intent delta, delegates
construction to an arbitrary inner loop, and later assesses the resulting
immutable change. The contract defines outcomes and load-bearing boundaries;
the target codebase remains the source of implementation context.

## Boundaries

- Own intent and authorization, not design or construction.
- Treat the contract plus the target codebase as the builder interface. Do not
  turn the contract into a self-contained implementation manual.
- Record only the requested behavior delta and boundaries plausibly endangered
  by that delta.
- Do not copy repository conventions, architecture, API inventories,
  implementation plans, or test plans into the contract.
- Do not invent monitoring, credentials, diagnostics, migrations,
  compatibility promises, or product surfaces merely to make assessment easy.
- Use only local Markdown paths. Do not add a service, database, issue-tracker
  adapter, or orchestration layer.
- Never approve on the user's behalf. Never edit an approved revision.

## Preconditions

Resolve these relative to this `SKILL.md` before running any step; nothing below
works if one of them is wrong.

- Read `../../resources/references/contract-format.md`.
- Bind `../../resources/scripts/steward` as `STEWARD_CLI`.
- Confirm Node.js is on `PATH` (`command -v node`); every CLI call runs as
  `node "$STEWARD_CLI" ...`. Stop and report if it is missing.

## Procedure

1. Inspect the request and only enough target-codebase context to distinguish
   current behavior, requested behavior, and material ambiguity. Existing
   repository instructions remain implementation context rather than contract
   content.
2. Create a format-v3 draft:

   ```bash
   node "$STEWARD_CLI" create path/to/ticket.md \
     --id short-ticket-id --title "Ticket title"
   ```

   Use `create --from` for a successor in the same format. Use
   `create NEW --from APPROVED --format 3` for a blank lean successor that
   preserves an approved v1/v2 artifact's lineage. Deliberately reframe its
   meaning; do not mechanically compress the old graph.
3. State one concise `Outcome`: the requested user or business result.
4. Write the fewest independently assessable `AC<n>` claims that distinguish
   success from failure. Preserve stable claim ids across revisions.
5. Add optional Context, Scope, Constraints, Examples, or Open questions only
   when the section records information that changes a material outcome:
   - Scope may name the change, an endangered invariant to preserve, or an
     important adjacent outcome explicitly excluded.
   - Constraints are genuine non-negotiable boundaries, not implementation
     preferences.
   - Examples disambiguate a claim; they are not a test inventory.
   - A material open question blocks approval. Ask the user instead of
     manufacturing a safe-looking default.
6. Leave unspecified implementation choices to the builder. Evidence methods
   are selected after construction and do not belong in a v3 contract.
7. If the request contains independently valuable outcomes or the draft grows
   beyond roughly eight claims or 1,200 words, first delete implementation
   detail. If it is still broad, recommend a small outcome-oriented split
   rather than multiplying traceability. These are guidance signals, not
   structural validity gates.
8. Recommend `critique` only when a trigger exists:
   - reasonable interpretations produce materially different outcomes;
   - the delta crosses an authorization, security, privacy, data-loss,
     migration, or compatibility boundary;
   - an acceptance claim may not distinguish pass from failure; or
   - the requested outcomes are unusually coupled.
9. Apply only accepted `contract-defect` findings. Keep builder discretion,
   follow-up work, and residual uncertainty out of the contract unless the
   scope owner explicitly expands intent.
10. Run `check`. Treat `STRUCTURALLY OK` as a syntax, lifecycle, and integrity
    result—not proof of semantic completeness.
11. Present the exact path, revision, concise claim summary, optional
    complexity warnings, and material open questions. Ask for explicit approval
    of that exact revision.
12. After explicit approval only, run:

    ```bash
    node "$STEWARD_CLI" approve path/to/ticket.md --by "Approver"
    ```

    Re-run `check` and report the frozen body hash.

## Judgment

- “Everything else remains unchanged” is not an invitation to inventory the
  system. Name only behavior the requested delta plausibly threatens.
- An external operator or client may be the honest validation boundary. Do not
  create synthetic infrastructure to replace it.
- If a claim cannot currently be observed, assessment may later be
  `inconclusive`; evidence inconvenience does not authorize new product scope.
- A more detailed contract is not necessarily safer. Prefer deletion, local
  clarification, or splitting over expansion.
