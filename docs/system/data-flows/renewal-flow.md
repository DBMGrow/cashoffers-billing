# Data Flow: Subscription Renewal

## Trigger
External scheduler → POST `/api/cron/subscriptions` with `CRON_SECRET` header

## Flow

```mermaid
flowchart TD
  A([Cron: POST /api/cron/subscriptions]) --> B[Query DB\nnext_renewal_at <= now\nstatus IN active, free_trial]
  B --> C{User active\nin Main API?}
  C -- No --> SKIP([Skip])
  C -- Yes --> E{cancel_on_renewal?}
  E -- Yes --> F[Deactivate subscription] --> DONE
  E -- No --> G{downgrade_on_renewal?}
  G -- Yes --> H[Downgrade to target product] --> DONE
  G -- No --> I{free_trial +\ntrial_ends_at expired?}
  I -- Yes --> J{HomeUptick addon?}
  J -- Yes --> J2[Read tier config from\nHomeuptick_Subscriptions\nFetch contact count from HU API\nCalculate tier charge]
  J -- No --> J3[Attempt payment\nfor renewal_cost]
  J2 --> K{Success?}
  J3 --> K
  K -- Yes --> L[status = active\nLog + update next_renewal_at\nEmit SubscriptionRenewed → email] --> DONE
  K -- No --> M[status = inactive\nLog failure\nEmit PaymentFailed → failure email\nupdateNextRenewalAttempt] --> DONE
  I -- No --> N[RenewSubscriptionUseCase]
  N --> HU{HomeUptick addon?}
  HU -- Yes --> S[Read tier config from\nHomeuptick_Subscriptions\nFetch contact count from HU API\nCalculate tier charge]
  HU -- No --> O[CreatePaymentUseCase → Square]
  S --> P{Success?}
  O --> P
  P -- Yes --> Q[Log + update next_renewal_at\nEmit SubscriptionRenewed → email] --> DONE
  P -- No --> R[Log failure\nEmit PaymentFailed → failure email\nupdateNextRenewalAttempt] --> DONE
  DONE([Done])
```

## Retry Schedule
| Failure | Next attempt |
|---------|-------------|
| 1st | +1 day |
| 2nd | +3 days |
| 3rd | +7 days |
| 4th | suspend (not yet automated) |

## HomeUptick Tier Calculation

At renewal, HU tier pricing is read from `Homeuptick_Subscriptions` (not from subscription JSON). See [HomeUptick Data Ownership](../../business/decisions/homeuptick-data-ownership).

1. Read `base_contacts`, `contacts_per_tier`, `price_per_tier` from `Homeuptick_Subscriptions`
2. Fetch current contact count from HU API
3. Calculate tiers: `max(0, ceil((contacts - base_contacts) / contacts_per_tier))`
4. Charge: `tiers × price_per_tier`

## Key Files
- `api/cron/subscriptionsCron.ts`
- `api/use-cases/subscription/renew-subscription.use-case.ts`
- `api/routes/cron/routes.ts`
