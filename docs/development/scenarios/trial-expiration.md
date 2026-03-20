# Scenario: Free Trial Expiration

## Goal
A free trial subscription expires and either converts to a paid subscription or is deactivated.

## Preconditions
- Subscription exists with status `free_trial`
- `trial_ends_at <= now`

## Steps (Success — converts to paid)
1. Cron runs and finds this subscription
2. Attempts payment for `renewal_cost`
3. Square charges successfully
4. Status updated to `active`
5. `next_renewal_at` set to `now + duration`
6. Renewal email sent

## Steps (Failure — card declined)
1. Cron runs and finds this subscription
2. Attempts payment — declined
3. Status updated to `inactive`
4. Failure email sent
5. No retry scheduled (trial expiration is one-shot)

## Expected Result (success)
- Subscription active, first payment logged, renewal scheduled

## Expected Result (failure)
- Subscription inactive, failure logged, no charge

## Linked Rules
- [Subscription Rules](../../business/rules/subscription-rules.md)
- [Payment Retry Rules](../../business/rules/payment-retry-rules.md)

## Integration Test
- Status: yes
- File: `api/tests/integration/free-trial.test.ts`

## Dev CLI Support
- Status: yes
- Command: `yarn dev:tools scenario trial-expiring`
