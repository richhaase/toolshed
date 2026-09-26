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

## Try it

After [installing the plugin](../../README.md#installation), ask for the skill
that fits the work:

| Need | Example request |
| --- | --- |
| Clarify a task | “Use Steward Frame: returning from employee details should restore the list's search, filters, and sorting. Draft only.” |
| Frame and build | “Use Steward to frame and make this edit: change ‘No sources found’ to ‘No sources yet.’ Nothing else changes.” |
| Get a second opinion | “Use Steward Critique on this agreement. Check for missing intent and unnecessary implementation restrictions.” |
| Check the result | “Use Steward Assess on the current changes against our agreement. Explain what the evidence establishes and what remains uncertain.” |

These are separate entry points, not mandatory stages. Include a file path when
the agreement or change is elsewhere; otherwise the conversation can hold the
agreement. Calling it a “contract” does not select a different format.

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

For the list-restoration example:

| Discovery | What happens next |
| --- | --- |
| Cached state works better than the proposed URL state | The builder changes approach and verifies the same result. |
| The chosen approach cannot restore sorting | The builder finds another approach or asks whether you want to change that requirement. It cannot drop sorting on its own. |
| You decide only search and filters need restoration | The agreement is updated to reflect your decision; assessment identifies that changed basis. |
| Direct links work, but restoration has not been observed | Assessment reports the missing evidence and leaves that result inconclusive. |

## Moving from frozen contracts

Steward 0.5 removes the former frozen-contract CLI, hashes, revision lifecycle,
and fixed assessment schema. There is no runtime dependency. Existing contracts
can still provide goal and boundary context; their explicit requirements remain
requirements until the owner changes them.

Bring the existing contract and any subsequent owner decisions to Frame or
Assess. There is no required conversion, renumbering, or new artifact. Goals,
success conditions, and boundaries still matter; approval metadata and hashes
are no longer Steward prerequisites. Assessment can use current uncommitted
work and explain its evidence in ordinary prose.

Project instructions that invoke the removed CLI need a deliberate owner
update. Existing project approval rules continue to apply until the owner
changes them; Steward does not override those rules or discard requirements
from an older contract.

## Reference and validation

The shared rules are in
[`goal-agreements.md`](resources/references/goal-agreements.md).
See [the delivery-status example](examples/delivery-status.contract.md) for a
complete Markdown agreement.

The canonical skill instructions are [Frame](skills/frame/SKILL.md),
[Critique](skills/critique/SKILL.md), and [Assess](skills/assess/SKILL.md).

Behavioral cases in [`evals/evals.json`](evals/evals.json) cover concise framing,
builder discretion, scope changes, and honest assessment. They describe expected
behavior, not recorded cross-model results. Repository validation checks skill
and distribution structure; it does not prove behavioral quality.
