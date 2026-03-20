# Data Flow: Subscription Renewal

## Trigger
External scheduler → POST `/api/cron/subscriptions` with `CRON_SECRET` header

## Flow

```
SubscriptionsCron
  1. Query DB: subscriptions where next_renewal_at <= now AND status IN (active, free_trial)
  2. For each subscription:
     a. GET user from Main API
        → if user.active == false: SKIP
     b. Check flags:
        → cancel_on_renewal: deactivate subscription, SKIP payment
        → downgrade_on_renewal: downgrade to target product, SKIP normal payment
     c. If free_trial + trial_ends_at expired:
        → Attempt payment for renewal_cost
        → On success: status = active
        → On failure: status = inactive, retry not applicable
     d. Normal renewal:
        → RenewSubscriptionUseCase
            → CreatePaymentUseCase → Square
            → Log transaction
            → Update next_renewal_at (+ duration)
            → Emit SubscriptionRenewed → send email
        → On failure:
            → Log failure
            → Emit PaymentFailed → send failure email
            → updateNextRenewalAttempt (retry schedule)
  3. Check for HomeUptick addon:
     → If exists: fetch tier from HomeUptick API, charge accordingly
```

## Retry Schedule
| Failure | Next attempt |
|---------|-------------|
| 1st | +1 day |
| 2nd | +3 days |
| 3rd | +7 days |
| 4th | suspend (not yet automated) |

## Key Files
- `api/cron/subscriptionsCron.ts`
- `api/use-cases/subscription/renew-subscription.use-case.ts`
- `api/routes/cron/routes.ts`
