# Decision: Product Categories

## Context

The billing system supports three fundamentally different product types, each representing a distinct business proposition:

1. **Premium CashOffers** — Full CO + HU bundle. Billing manages the user's CO account (role, premium status) and provides HomeUptick access. The standard subscription product.

2. **External CashOffers** — For users who already have an active premium CashOffers account managed outside of billing (e.g., through their brokerage or KW Offerings). They don't need CO account management — they just need HomeUptick. The base fee is typically $0/month since they're paying for CO separately; this subscription only accounts for HomeUptick tier usage overages.

3. **HomeUptick Only** — For users who want HomeUptick access without a full CO premium subscription. Billing creates a SHELL CO account (enough to authenticate into the portal) and provides HU access. Has a base monthly fee (e.g., $20/month).

Previously, product type was implicit — inferred from a combination of `cashoffers.managed`, `user_config.role`, and `user_config.is_premium` in the product's JSON data field. This made queries difficult and required code to reverse-engineer the product's intent from multiple flags.

## Decision

Add an explicit `product_category` column to the `Products` table with three values:

| Category | Enum value | CO managed | CO role | is_premium | Base fee |
|---|---|---|---|---|---|
| Premium CashOffers | `premium_cashoffers` | true | AGENT | 1 | Paid |
| External CashOffers | `external_cashoffers` | false | — | 0 | $0 (overages only) |
| HomeUptick Only | `homeuptick_only` | true | SHELL | 0 | Paid |

The `data` JSON field still holds CashOffers configuration (managed flag, user_config) and HomeUptick templates (tier pricing, free trial settings). `product_category` is a quick-filter label for queries, not a replacement for the detailed config.

> **Note:** HomeUptick config in `Products.data.homeuptick` is a _template_. At purchase/enrollment, it seeds a `Homeuptick_Subscriptions` row — that row is the live source of truth. See [HomeUptick Data Ownership](homeuptick-data-ownership).

## Why This Matters Now

The manage page needs to show the right products to users without a billing subscription:

- User has an active external CO account → show `external_cashoffers` products
- User has no CO account or only SHELL access → show `homeuptick_only` products
- Existing subscribers see `premium_cashoffers` upgrade/downgrade options

Without `product_category`, every query that needs to distinguish product types must parse nested JSON — which is fragile, slow, and impossible to index.

## Alternatives Considered

- **Infer from JSON flags at query time**: Current approach. Fragile — requires matching multiple fields. No SQL-level filtering.
- **Separate tables per product type**: Over-engineering. The products share 95% of their schema.
- **Use `product_type` column**: Already used for billing frequency (`none`, `one-time`, `subscription`). Different concern.

## Tradeoffs

- One more column to set when creating products — but it's an ENUM, so it's self-documenting and validated
- Existing products need a backfill (all current products are `premium_cashoffers`)
- The JSON data remains the source of truth for behavior; `product_category` is the source of truth for identity

## Required Product Configs Per Category

Each product category requires specific `data` JSON configuration. Below are the expected shapes.

### `premium_cashoffers`

Full CO + HU bundle. Billing manages the user's CO account.

```json
{
  "signup_fee": 0,
  "renewal_cost": 25000,
  "duration": "monthly",
  "cashoffers": {
    "managed": true,
    "user_config": {
      "is_premium": 1,
      "role": "AGENT",
      "whitelabel_id": null,
      "is_team_plan": false
    }
  },
  "homeuptick": {
    "enabled": true,
    "base_contacts": 500,
    "contacts_per_tier": 500,
    "price_per_tier": 7500,
    "free_trial": null
  }
}
```

**Required fields:** `cashoffers.managed = true`, `cashoffers.user_config.is_premium = 1`, `cashoffers.user_config.role` (typically AGENT, INVESTOR, or TEAMOWNER).

**HomeUptick:** Should have `homeuptick.enabled = true` with explicit tier pricing. If omitted, defaults are applied (500 base contacts, 500/tier, $0/tier).

### `external_cashoffers`

For users with CO managed externally (brokerage, KW Offerings). HU overages only.

```json
{
  "signup_fee": 0,
  "renewal_cost": 0,
  "duration": "monthly",
  "cashoffers": {
    "managed": false
  },
  "homeuptick": {
    "enabled": true,
    "base_contacts": 500,
    "contacts_per_tier": 500,
    "price_per_tier": 7500
  }
}
```

**Required fields:** `cashoffers.managed = false`, `renewal_cost = 0` (base fee is $0; only HU overages charged).

**No `user_config`:** Billing does not manage the CO account — no role or premium status changes.

**Purchase path:** These products are NOT available on the main signup flow (`/purchase/new`). They are purchased via the manage flow (`/purchase/existing`) by users who already have an external CO account.

### `homeuptick_only`

HU access with SHELL CO account for portal login.

```json
{
  "signup_fee": 0,
  "renewal_cost": 2000,
  "duration": "monthly",
  "cashoffers": {
    "managed": true,
    "user_config": {
      "is_premium": 0,
      "role": "SHELL",
      "whitelabel_id": null
    }
  },
  "homeuptick": {
    "enabled": true,
    "base_contacts": 500,
    "contacts_per_tier": 500,
    "price_per_tier": 5000,
    "free_trial": {
      "enabled": true,
      "contacts": 100,
      "duration_days": 90
    }
  }
}
```

**Required fields:** `cashoffers.managed = true`, `cashoffers.user_config.role = "SHELL"`, `cashoffers.user_config.is_premium = 0`.

**HomeUptick:** May include a free trial configuration. The `free_trial` block seeds `Homeuptick_Subscriptions` with trial dates. **Note: billing-managed free trials are WIP — do not configure `free_trial` on products until the signup UI properly communicates trial terms.**

## Impact

- Migration: `010_add_product_category.sql`
- All product creation (admin, dev CLI, seed data) must set `product_category`
- Manage page routes filter by `product_category` instead of parsing JSON
- `GET /manage/products` gains `product_category` filter parameter
- `db.d.ts` types updated to include the new column
