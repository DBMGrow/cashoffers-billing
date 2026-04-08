# Decision: HomeUptick Data Ownership

## Context

HomeUptick subscription config (base contacts, tier pricing, free trial settings) was being stored in two places:

1. **`Homeuptick_Subscriptions` table** — dedicated table with columns for `base_contacts`, `contacts_per_tier`, `price_per_tier`, free trial fields
2. **`Subscriptions.data.productData.homeuptick`** — JSON blob snapshotted from the product at purchase time

The renewal flow read from the JSON blob. External systems read from the table. This created drift risk and no clear source of truth.

Additionally, external CashOffers users (`external_cashoffers` category) can activate an HU free trial **without having a billing subscription**. In that case, there's no `Subscriptions` record to hold the HU config — the only place it can live is `Homeuptick_Subscriptions`.

## Decision

**`Homeuptick_Subscriptions` is the single source of truth for a user's HomeUptick configuration.**

- **`Products.data.homeuptick`** = template. Defines the HU config (base contacts, tier pricing, free trial settings) that a product provides.
- **`Homeuptick_Subscriptions`** = live record. Created from the product template at purchase/enrollment time. All runtime reads (renewal, billing, external systems) pull from here.
- **`Subscriptions.data`** does NOT store homeuptick config. The subscription JSON holds `cashoffers` config and `user_config` only.

### Data flow

```
Product.data.homeuptick (template)
        │
        ▼  at purchase/enrollment
Homeuptick_Subscriptions (live record)
        │
        ▼  at renewal
Renewal flow reads tier config from Homeuptick_Subscriptions
```

### What lives where

| Data | Location | Purpose |
|------|----------|---------|
| HU tier pricing template | `Products.data.homeuptick` | Blueprint for new subscriptions |
| HU free trial template | `Products.data.homeuptick.free_trial` | Blueprint for trial config |
| User's live HU config | `Homeuptick_Subscriptions` row | Runtime source of truth |
| CO account config | `Subscriptions.data.productData.cashoffers` | Billing-managed CO settings |
| User config snapshot | `Subscriptions.data.user_config` | Audit trail of applied config |

## Why Not Just Use Subscription JSON?

1. **External users without subscriptions**: An `external_cashoffers` user can have HU access (including a free trial) without a billing subscription. No subscription record = nowhere to put the JSON.
2. **External system reads**: Other systems already query `Homeuptick_Subscriptions` directly. Forcing them to parse nested JSON from a different table adds coupling.
3. **Single source of truth**: Two copies of the same data inevitably drift. One authoritative location eliminates reconciliation bugs.

## Impact

- **Purchase flow**: After creating a subscription, seed a `Homeuptick_Subscriptions` row from `Products.data.homeuptick`
- **Enrollment flow**: For external users enrolling in HU, create `Homeuptick_Subscriptions` row (may happen before or without a billing subscription)
- **Renewal flow**: Read tier config from `Homeuptick_Subscriptions`, not from subscription JSON
- **`SubscriptionData` type**: Remove `homeuptick` from `productData` — it's no longer stored there
- **Product types**: `HomeUptickConfig` stays on `ProductData` as the template definition
