# Capability: Promo Codes

## Business Outcome

A white label can run a campaign code that discounts a new subscription's first charge, and see
afterwards who used it, what it cost, and whether those subscribers went on to pay. First use:
eXp's `EXPCON`, the first month of ExpressOffers Pro free for agents who sign up at eXpCon 2026.

## Actors

- **Agent**: enters a code at checkout, or arrives on a link that carries one (`?coupon=EXPCON`)
- **Staff**: creates codes (SQL, below) and runs the report
- **System**: validates the code, discounts the first charge, records the redemption

## What Should Happen

### At checkout

1. A code arrives from `?coupon=` (signup `/<whitelabel>/subscribe/<product>` or
   `/manage?...&goto=enrollment&product=<id>`), or the agent types it into "Have a promo code?".
2. The page asks `GET /api/purchase/promo/validate?code=&product_id=&flow=signup|manage` and shows
   the quote, e.g. "Promo EXPCON: First month free, $0.00 today, then $49.00/mo". The quote is display
   only.
3. The card step stays. A promo'd $0 purchase still saves a card, because the first renewal charges it.

### At purchase (server-side, never trusting the page)

1. After the product and list pricing are known, and **before any card is created or charged**, the
   use case evaluates the code and reserves a redemption in one transaction that locks the code's row
   (`SELECT ... FOR UPDATE`), so `max_redemptions` and `max_per_user` hold when purchases race.
2. A code that does not apply fails the purchase with `PROMO_CODE_INVALID` (HTTP 400, no developer
   alert) and a customer-facing reason. Nothing is charged. The page drops the code and says why; the
   agent can continue at full price.
3. A valid code lowers today's charge (`initialAmount`). If it reaches $0, Square is not called but the
   card is still saved.
4. The subscription is created at the **list** renewal price. `Subscriptions.amount` is never
   discounted: renewals charge it and reconciliation matches it against the product's `renewal_cost`
   (see [role_v2 decision](../decisions/role-v2)).
5. The redemption is linked to the subscription (and to the user once provisioned). The welcome email
   and the payment receipt carry a negative line, "Promo EXPCON: First month free -$49.00", and a $0
   welcome email says nothing was charged.
6. If the purchase fails before any charge and before the subscription exists (card declined, for
   example), the redemption is voided so a retry can use the code. A redemption whose purchase took
   money or created a subscription stays for manual resolution.

## Rules

- Codes are stored uppercase and matched case-insensitively.
- A code applies when: `active`, now is in `[starts_at, ends_at)`, the product's `whitelabel_code`
  matches (NULL = any), the product is in `product_ids` (NULL = any), and the product's
  `data.cashoffers.user_config.role_v2` is in `product_roles` (NULL = any).
- `max_redemptions` counts every non-voided redemption; `max_per_user` counts the buyer's, matched on
  email or user id; `new_users_only` refuses a buyer who has or had a subscription with `amount > 0`
  (an ExpressOffers Guest's $0 subscription does not count).
- Discount types, applied to the part of the first charge named by `applies_to`:
  - `free_periods`: the whole part is free.
  - `percent`: `discount_value` percent off (capped at 100).
  - `amount`: `discount_value` cents off, never below $0.
- `applies_to = first_period` discounts the first billing period and leaves a signup fee in place.
  `first_charge` discounts the whole first charge, signup fee included. A new signup's first charge
  includes a signup fee (`data.signup_fee`, or `Products.price` when that is unset); an existing
  account upgrading through `/manage` has none.
- Only the first charge is discounted today. `free_periods > 1` or `duration_periods > 1` is recorded on
  the redemption (`periods_total`, `periods_remaining`) for a later renewal phase, and the checkout text
  promises only the first period. Do not market "3 months free" until renewals read it.

## Data

- `PromoCodes` and `PromoRedemptions`, migration `api/database/migrations/014_promo_codes.sql`.
- `PromoRedemptions.purchase_request_id` is UNIQUE: one purchase request redeems at most once.
- Amounts are cents. `status`: `applied` (live), `voided` (released, not counted), `exhausted`
  (reserved for the renewal phase).
- `external_coupon_id` is reserved for mapping to a coupon in another processor (Stripe).
- `PurchaseRequests.request_data` keeps the raw `coupon` the client sent; payment and subscription
  transactions carry `promo` (code, redemption id, original and discount amounts) in `data`.

## How to create a code

Hand-run SQL, like the migrations. Copy `api/database/seeds/001_expcon_promo.sql` and change the
values. Minimal example:

```sql
INSERT INTO PromoCodes
  (code, description, whitelabel_code, product_roles, discount_type, discount_value,
   applies_to, max_per_user, ends_at, new_users_only, campaign, created_by)
VALUES
  ('SPRING25', '25% off the first month', 'EXP', JSON_ARRAY('AGENT_EXP_PRO'), 'percent', 25,
   'first_period', 1, '2027-04-30 23:59:59', 1, 'Spring 2027', 'you@example.com');
```

To stop a code: `UPDATE PromoCodes SET active = 0 WHERE code = 'SPRING25';` Redemptions are kept.

Check a code without buying: `GET /api/purchase/promo/validate?code=SPRING25&product_id=<id>&flow=manage`.

## How to run the report

`api/database/reports/promo-redemptions.sql` is read-only. Set `@campaign`, `@whitelabel` or `@code` at
the top (NULL = all) and run it through the database tunnel with any MySQL client, e.g.
`mysql -h 127.0.0.1 -P <tunnel port> -u <user> -p <db> < api/database/reports/promo-redemptions.sql`.
It returns one row per redemption (email, name, signup date, product, original / discount / charged
amounts, current subscription status, next renewal, and whether and when the first paid renewal
happened), then totals per campaign and white label (redemptions, total discount, still active,
converted to paid).

"First paid renewal" is the first `PurchaseRequests` row with `request_type = 'RENEWAL'`,
`status = 'COMPLETED'` and `amount_charged > 0` for the subscription.

## Endpoint

`GET /purchase/promo/validate` (public, OpenAPI in `api/routes/purchase/schemas.ts`). Rate limited to
30 requests a minute per IP, in memory per server instance: it slows guessing, it does not stop a
distributed attacker. It checks everything except per-buyer limits and `new_users_only`, which need the
buyer and are checked at purchase.

## Edge Cases

- Two agents racing for the last redemption: the row lock serializes them; the second gets
  "That promo code has reached its redemption limit." before being charged.
- The same agent retries after a declined card: the first reservation was voided, the retry redeems.
- A code on a free product: refused ("doesn't apply to this plan"), since there is nothing to discount.
- A product with no `whitelabel_code` (shared) never matches a white-label-scoped code.

## Key Files

- `api/domain/services/promo-evaluation.ts` (pure `evaluatePromo`, unit tested)
- `api/infrastructure/database/repositories/promo-code.repository.ts` (locked reservation)
- `api/use-cases/subscription/promo-helpers.ts` (the purchase-flow steps and `quotePromo`)
- `api/use-cases/subscription/purchase-new-user.use-case.ts`, `purchase-existing-user.use-case.ts`
- `components/forms/promo/PromoCodeField.tsx`, `hooks/api/useValidatePromo.ts`

## Unknowns

- The production ExpressOffers Pro `product_id` is not confirmed; `EXPCON` is scoped by white label and
  role instead (see the seed's placeholders).
- Whether renewals should honour `periods_remaining` (a multi-month promo) is not built.
