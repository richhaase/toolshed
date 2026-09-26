# <img src="assets/icon.png" width="64" height="64" align="middle" alt=""> Steward — clear goals with room to adapt

Steward helps software agents stay aligned with the user's goal while leaving
them room to discover a good solution. An agreement captures the desired result,
a few success conditions, and essential boundaries.

- `frame` writes the agreement, reusing decisions and authorization already given.
- `critique` checks for material gaps and unnecessary restrictions when needed.
- `assess` judges the result using proportionate evidence.

Any construction workflow can do the work. Builders own implementation choices
and can revise their approach as they learn. Material changes to the goal,
success conditions, or boundaries return to the user.

## An ordinary agreement

> Goal: People returning from employee details can resume their list work.
>
> Success: Browser Back restores their search, filters, and sort selection.
>
> Boundaries: Direct employee-detail links still work. Existing access controls
> remain effective.

The builder can choose URL state, cached state, or another suitable mechanism.
There is no need to select that mechanism before starting or amend the agreement
when it changes. Dropping filter restoration or weakening access controls would
require a user decision.

A copy edit may need only a sentence. Larger work may need several bullets.
Success can be qualitative when concrete evidence supports a reasoned judgment.
Boundaries are assessed directly, without copying them into numbered claims.

## Working with Steward

Agreements live in conversation or ordinary Markdown. A clear authorized request
needs no extra approval round. A framing-only request still stops at the draft;
Steward does not create authority to implement, delegate, or publish.

Critique is useful for a real unresolved tradeoff or when the user requests a
second opinion. It is not a mandatory stage. Several acceptable solutions are
not a defect, and implementation preferences should not become requirements.

Assessment can inspect current uncommitted work. It reports pass, fail, or
inconclusive, explains the observed evidence, and identifies meaningful gaps.
Unavailable operator evidence stays unverified; a demonstrated violation of a
requirement fails. The assessor cannot waive a requirement to make the work pass.

When discoveries require an owner decision, ask for that decision and keep
unaffected work moving. Record an authorized change in the agreement itself,
with a brief explanation. No successor artifact is needed.

## Format and validation

Steward 0.5 removes the former frozen-contract CLI, hashes, revision lifecycle,
and fixed assessment schema. There is no runtime dependency. Existing contracts
can still provide goal and boundary context; their explicit requirements remain
requirements until the owner changes them.

The shared rules are in
[`goal-agreements.md`](resources/references/goal-agreements.md).
See [the delivery-status example](examples/delivery-status.contract.md) for a
complete Markdown agreement.

Behavioral cases in [`evals/evals.json`](evals/evals.json) cover concise framing,
builder discretion, scope changes, and honest assessment. They describe expected
behavior, not recorded cross-model results. Repository validation checks skill
and distribution structure; it does not prove behavioral quality.
