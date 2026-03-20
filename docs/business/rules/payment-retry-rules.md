# Rule: Payment Retry Rules

## Definition
When a subscription payment fails, the system automatically schedules retries at escalating intervals before giving up.

## Retry Schedule

| Attempt | Wait Before Retry |
|---------|------------------|
| 1st failure | Retry after 1 day |
| 2nd failure | Retry after 3 days |
| 3rd failure | Retry after 7 days |
| 4th failure | Suspend subscription (not yet automated) |

## Rules
1. Each failed attempt updates `next_renewal_at` to the next retry time.
2. A payment failure always logs a transaction record.
3. A payment failure always sends a failure notification email.
4. After max retries are exhausted, the subscription should be suspended — this is flagged but the automated cron for suspension is not yet implemented.
5. Card update retry: if a user updates their card during a retry window, the next retry uses the new card.

## Where Enforced
- `api/cron/subscriptionsCron.ts` — `updateNextRenewalAttempt()`
- `api/use-cases/subscription/renew-subscription.use-case.ts`

## Missing Enforcement
- Suspension after max retries is not automated — the suspension cron (`suspendSubscriptionsCron`) is stubbed.
- Card update during retry window: card update endpoint in `/manage` has a known TODO (Square card update logic not implemented).
