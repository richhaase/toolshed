---
name: simplify
description: >
  Make a completed software change fit its repository better and cost less to
  maintain while preserving intended behavior. Use when the user asks to
  simplify or refactor recent work, apply local simplification findings, or
  give a completed change a finishing pass. Implement worthwhile improvements
  and verify them; requests only for suggestions stay advisory. This is an
  optional pass over the current change, not repository-wide normalization.
---

# Simplify

Revisit the completed work with the surrounding codebase in view. Reduce the
maintenance burden of this change without changing what it accomplishes.
Finding nothing worth changing is a successful result.

## Establish the scope and context

Use the user's request, recent work, and available diff to identify the change
being simplified and the behavior it must preserve. If the target is unclear,
ask one focused question rather than treating the whole repository as the task.
Respect existing user edits and unrelated work.

Read relevant repository instructions, nearby implementations, shared helpers,
tests, and affected documentation. Look broadly enough to understand established
patterns and reuse opportunities; keep edits within the completed change and
directly related code or documentation. An older inconsistency elsewhere does
not enlarge this task.

## Choose improvements that earn their place

Look for avoidable duplication, obsolete branches or indirection left by
iteration, unnecessary custom machinery, and explanations made inaccurate by
the change. Prefer existing authoritative rules and helpers when they express
the same behavior. Update affected comments or docs where that reduces confusion
or prevents multiple accounts of the same rule from drifting.

Each edit needs a concrete benefit, such as fewer places to maintain a rule,
clearer control flow, or reuse of a demonstrated repository pattern. Consistent
appearance, fewer lines, and more abstraction are not benefits by themselves.
Do not couple unrelated features or create a general framework to make similar
code look alike. Where repository patterns conflict, prefer relevant maintained
examples and explicit instructions over inventing a new standard.

Before reusing or consolidating code, establish that its semantics fit: inputs,
outputs, errors, side effects, access rules, and relevant performance constraints.
Superficial similarity is insufficient. Keep a candidate unchanged when its
benefit or behavioral equivalence cannot be established. Identify a meaningful
behavior or scope decision for the user instead of making it under the label
of simplification; continue with other worthwhile local improvements.

## Apply and verify

A request to simplify authorizes appropriate edits within that scope. Implement
the useful changes without asking for approval of routine refactoring. When the
request is only to review or suggest, describe the candidates and leave files
unchanged. Do not remove capabilities, change public interfaces, or relax user
requirements merely because Check reported them as excessive.

Use focused checks that exercise the behavior affected by the edits, including
any non-obvious equivalence that justified reuse. Preserve useful regression
coverage; do not weaken tests to accommodate a changed result. If evidence
contradicts preservation, correct or revert your own attempted simplification.
An earlier successful check does not validate code changed afterward.

Stop when the worthwhile local improvements are handled. Do not keep finding
more work to justify the pass. Briefly explain what became easier to maintain,
what was verified, and any material limitation; no report artifact is required.
If Simplify and a final Check are both requested, Check evaluates the resulting
state. Neither skill is a mandatory stage or prerequisite for the other.

Steward does not support its former contract formats. Do not interpret, import,
convert, or validate an old Steward contract. Use the current goal and relevant
user choices in ordinary language.
