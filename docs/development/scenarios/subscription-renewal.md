# Scenario: Subscription Renewal

## Goal
An active subscription is automatically renewed by the cron job.

## Preconditions
- Subscription exists with status `active`
- `next_renewal_at <= now`
- User is active in main API
- User has a card on file

## Steps
1. Cron runs: POST `/api/cron/subscriptions`
2. Cron finds this subscription
3. Fetches user from main API — user is active
4. No cancel/downgrade flags set
5. `RenewSubscriptionUseCase` executes
6. Square charges the renewal cost
7. `next_renewal_at` updated to `now + duration`
8. Renewal confirmation email sent

## Expected Result
- Transaction record created (success)
- `next_renewal_at` advanced
- Email sent
- User config unchanged (renewals don't update user configuration)

## Edge Cases
- User inactive → skip, no charge
- Payment fails → retry scheduled, failure email sent
- `cancel_on_renewal` → deactivate instead of charge
- `downgrade_on_renewal` → downgrade instead of charge

## Linked Rules
- [Subscription Rules](../../business/rules/subscription-rules.md)
- [Payment Retry Rules](../../business/rules/payment-retry-rules.md)

## Integration Test
- Status: yes
- File: `api/tests/integration/cashoffers-module.test.ts`

## Dev CLI Support
- Status: yes
- Commands:
  - `yarn dev:tools scenario renewal-due` — set subscription due
  - `yarn dev:tools cron-preview` — dry run
  - `yarn dev:tools cron-run <user_id>` — execute for one user
