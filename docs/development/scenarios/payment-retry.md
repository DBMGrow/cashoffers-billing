# Scenario: Payment Retry

## Goal
When a renewal payment fails, the system retries at escalating intervals before giving up.

## Preconditions
- Subscription is active
- Payment fails on renewal attempt

## Steps
1. Cron runs, renewal payment fails
2. `updateNextRenewalAttempt` sets `next_renewal_at = now + 1 day` (1st retry)
3. Failure email sent to user
4. Cron runs again next day, payment fails again
5. `next_renewal_at = now + 3 days` (2nd retry)
6. Another failure email sent
7. Cron runs after 3 days, payment fails again
8. `next_renewal_at = now + 7 days` (3rd retry)
9. After 3rd retry fails → suspension (not yet automated)

## Expected Result
- Subscription stays active through retry window
- Each failure is logged
- User receives failure notifications
- After final failure: subscription suspended (pending automation)

## Linked Rules
- [Payment Retry Rules](../../business/rules/payment-retry-rules)

## Integration Test
- Status: yes
- File: `api/tests/integration/retry-and-suspension.test.ts`

## Dev CLI Support
- Status: yes
- Command: `yarn dev:tools scenario payment-retry`
