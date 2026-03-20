# Scenario: HomeUptick Addon Renewal

## Goal
A user with a HomeUptick addon subscription has both their main subscription and their HomeUptick addon renewed together.

## Preconditions
- User has an active main subscription
- User also has an active HomeUptick addon subscription
- Both are due for renewal

## Steps
1. Cron runs
2. Main subscription renews normally
3. Cron checks: does this user have a HomeUptick addon? Yes.
4. Fetch user's current tier from HomeUptick API
5. Charge addon amount based on tier
6. Update HomeUptick subscription `next_renewal_at`

## Expected Result
- Two charges processed (main + addon)
- Two transaction records
- Both subscriptions updated

## Edge Cases
- HomeUptick API unavailable → addon fails, main still renews
- User's tier changed → new cost applied on this renewal

## Linked Rules
- [Subscription Rules](../../business/rules/subscription-rules.md)

## Integration Test
- Status: yes
- File: `api/tests/integration/homeuptick-module.test.ts`
- File: `api/tests/integration/renewal-homeuptick-tiers.test.ts`

## Dev CLI Support
- Status: no

## Known Issues
- Tier-based renewal cost logic has a TODO at `api/use-cases/subscription/renew-subscription.use-case.ts:114`
