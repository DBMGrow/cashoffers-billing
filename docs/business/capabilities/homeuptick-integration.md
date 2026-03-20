# Capability: HomeUptick Integration

## Business Outcome
Users on certain plans can have an add-on HomeUptick subscription that is managed in parallel with their main CashOffers subscription.

## Actors
- **User**: Has a main subscription + optional HomeUptick addon
- **System (cron)**: Renews both subscriptions together

## What Should Happen

### Addon Subscription
- A HomeUptick subscription is a separate subscription record linked to the user
- It is renewed via the same cron job as regular subscriptions
- Its cost may vary by tier (fetched from HomeUptick API)

### Renewal with HomeUptick
1. Main subscription renews normally
2. Cron checks if user also has a HomeUptick addon subscription
3. If yes: fetch current tier from HomeUptick API, charge accordingly
4. Update HomeUptick subscription `next_renewal_at`

## Edge Cases
- HomeUptick API is unavailable → addon renewal fails, main subscription still renews
- User's HomeUptick tier changes → new cost on next renewal

## Related Scenarios
- [HomeUptick Addon Renewal](../../development/scenarios/homeuptick-addon)

## Current vs Intended Behavior
- HomeUptick tier-based renewal has a known TODO in `renew-subscription.use-case.ts:114`
- Integration test exists that verifies this behavior: `api/tests/integration/renewal-homeuptick-tiers.test.ts`

## Unknowns
- Whether HomeUptick addon cancellation is handled separately or via the main subscription flow.
