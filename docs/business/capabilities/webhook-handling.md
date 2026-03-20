# Capability: Webhook Handling

## Business Outcome
The billing system reacts to user state changes in the main CashOffers API. When a user is deactivated, their subscription renewal is skipped. When reactivated, they resume normal billing.

## Actors
- **Main CashOffers API**: Sends webhook events
- **System**: Receives and processes them

## What Should Happen

### User Deactivated
1. Main API sends POST to `/api/webhooks` with event type `user.deactivated`
2. Billing system records user as inactive (or reads `active` field at renewal time)
3. Cron will skip this user on next renewal cycle

### User Activated
1. Main API sends POST to `/api/webhooks` with event type `user.activated`
2. Billing system records user as active
3. Next renewal proceeds normally

## Edge Cases
- Webhook arrives for unknown user → log and ignore
- Duplicate webhook delivery → idempotent handling required

## Related Scenarios
- [Webhook User Deactivation](../../development/scenarios/webhook-user-deactivation)

## Current vs Intended Behavior
- CashOffers webhook handler exists at `api/routes/webhooks/routes.ts`
- Integration test: `api/tests/integration/webhook-cashoffers.test.ts`
- Square payment webhooks are configured but handler location is unclear — see discrepancies.

## Unknowns
- Whether Square webhook events are fully handled or just partially wired.
- Webhook authentication mechanism (secret verification) — confirm implementation.
