---
steward_contract: "3"
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

## Outcome

Dispatchers can understand a failed delivery without reading server logs.

## Scope

### Change

- Show a safe failure reason in the existing delivery details.

### Preserve

- Existing classification remains the authority for whether upstream text is safe to display.

### Not in scope

- Changing upstream delivery behavior or localizing reason text.

## Acceptance

- AC1: Opening a rejected delivery with a safe upstream reason displays that reason.
- AC2: Opening a rejected delivery without a safe reason displays "Delivery failed; contact support."

## Constraints

- Upstream text classified as unsafe must not be displayed.
