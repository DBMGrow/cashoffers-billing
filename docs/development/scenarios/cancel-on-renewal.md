# Scenario: Cancel on Renewal

## Goal
A user decides to cancel. Their subscription stays active until the end of the billing period, then is cancelled automatically.

## Preconditions
- Subscription is active

## Steps
1. User calls `POST /api/subscription/:id/cancel`
2. `cancel_on_renewal` flag is set to `true`
3. Subscription remains active — no immediate cancellation
4. On next cron run when `next_renewal_at` is due:
   - Cron detects `cancel_on_renewal: true`
   - Deactivates subscription instead of charging
5. Cancellation email sent

## Expected Result
- User has access until end of period
- No charge on what would have been the renewal date
- Subscription becomes inactive

## Edge Cases
- User changes mind: call `POST /api/subscription/:id/uncancel` to remove flag

## Linked Rules
- [Subscription Rules](../../business/rules/subscription-rules.md)

## Integration Test
- Status: yes
- File: `api/tests/integration/cashoffers-module.test.ts`

## Dev CLI Support
- Status: no
