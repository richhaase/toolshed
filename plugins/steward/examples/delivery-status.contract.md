---
steward_contract: "2"
id: "delivery-status"
title: "Explain failed deliveries"
revision: 1
state: draft
created_at: "2026-01-01T00:00:00.000Z"
approved_at: null
approved_by: null
frozen_body_sha256: null
supersedes: null
---
# Explain failed deliveries

## Intent

- I1: Dispatchers can understand a failed delivery without reading server logs.

## Context

The delivery list already shows success and failure status but not a failure
reason. The upstream response may contain either a safe reason or no usable
reason.

## Scope

### In scope

- Show a safe failure reason in the existing delivery details.
- Provide a stable fallback when no safe reason is available.

### Out of scope

- Changing upstream delivery behavior.
- Localizing reason text in this revision.

## Requirements

- R1 [I1]: A failed delivery exposes a user-visible failure reason.
- R2 [I1]: An absent or unsafe upstream reason uses the approved safe fallback.

## Acceptance claims

- AC1 [I1; R1]: A dispatcher opening a rejected delivery sees its safe upstream reason.
- AC2 [I1; R2]: A dispatcher opening a rejection without a safe reason sees "Delivery failed; contact support."

## Evidence plan

- EV1 [AC1]: Trigger a synthetic rejection with a safe reason and capture the delivery details.
- EV2 [AC2]: Trigger missing and unsafe reason fixtures and capture the fallback shown for each.

## Intent probes

- P1 [normal; AC1; EV1]: Given a routine address rejection, the dispatcher sees "Address rejected."
- P2 [failure; AC2; EV2]: Given an unsafe reason containing credentials, the dispatcher sees only the safe fallback.
- P3 [accepted-tradeoff; AC2; EV2]: Reason localization is deferred; the approved English fallback remains visible and assessable.

## Constraints

- Do not display upstream text classified as unsafe.

## Assumptions and risks

### Assumptions

- The existing safety classifier remains the source of truth for reason safety.

### Risks

- A generic fallback may require support follow-up.

## Open questions

### U1: Which localized wording should replace the English fallback?
- Status: non-blocking
- Owner: Content design
- Decision deadline or trigger: Before localization launch
- Safe default: Use the approved English fallback
- Assessment rationale: AC2 and P2 define observable behavior under the fallback
