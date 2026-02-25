# Purchase Endpoint Split: New User vs Existing User

## Overview

The original single `POST /purchase` endpoint was split into two separate endpoints with distinct contracts and authentication requirements.

## Problem with the Original Endpoint

1. **Weak schema validation** — fields like `phone`, `card_token`, and `api_token` were all optional in the Zod schema; required-field enforcement happened deep in the use case via runtime errors rather than at the HTTP boundary.
2. **Non-standard auth for existing users** — existing users had to pass `api_token` in the request body, bypassing the standard session mechanism (header/cookie) used by every other authenticated endpoint.

---

## New Endpoints

### `POST /purchase/new` — New User Purchase

**Auth:** None (public endpoint — new users don't have tokens yet)

**Required fields:**
- `product_id`
- `email`
- `phone`
- `card_token`, `exp_month`, `exp_year`, `cardholder_name`

**Optional fields:**
- `name`, `coupon`, `mock_purchase`, `whitelabel`, `slug`, `url`, `name_broker`, `name_team`, `isInvestor`

**Behavior:**
1. Validates product
2. Creates card with `userId = null`
3. Creates user in main API with product's `user_config` (sets `is_premium`, `role`, `whitelabel_id`)
4. Links card to new user
5. Processes payment via Square
6. Creates subscription
7. Publishes `UserCreatedEvent` + `SubscriptionCreatedEvent`
8. Sets `_api_token` cookie from the new user's token (if available)

**Response:** `userCreated: true`

---

### `POST /purchase/existing` — Existing User Purchase

**Auth:** Required — `x-api-token` header or `_api_token` cookie

User identity (`userId`, `email`) is resolved entirely from the session token by `authMiddleware`. No user fields are needed in the request body.

**Required fields:**
- `product_id`

**Optional fields:**
- `card_token`, `exp_month`, `exp_year`, `cardholder_name` (to update card on file)
- `coupon`, `mock_purchase`

**Behavior:**
1. Auth middleware validates session and sets `c.get("user")` and `c.get("paymentContext")`
2. Validates product
3. If card token provided: creates/updates card; otherwise uses existing card on file
4. Processes payment via Square
5. Creates subscription
6. Publishes `SubscriptionCreatedEvent`

**Response:** `userCreated: false`

---

## Implementation Details

### Files Changed

| File | Change |
|------|--------|
| `api/routes/purchase/schemas.ts` | Replaced `PurchaseRequestSchema` with `NewUserPurchaseRequestSchema` and `ExistingUserPurchaseRequestSchema`; added `NewUserPurchaseRoute` and `ExistingUserPurchaseRoute` |
| `api/routes/purchase/routes.ts` | Replaced single handler with two handlers; existing-user handler uses `authMiddleware(null)` |
| `api/use-cases/types/subscription.types.ts` | Added `userId?: number` to `PurchaseSubscriptionInput` |
| `api/use-cases/types/validation.schemas.ts` | Added `userId` field to `PurchaseSubscriptionInputSchema` |
| `api/use-cases/subscription/purchase-subscription.use-case.ts` | User resolution block now checks `validatedInput.userId` first; if provided, skips email lookup and user creation |

### Use Case Logic (User Resolution)

```
if validatedInput.userId is set:
  → Use it directly (existing user via session)
else:
  → Look up by email
  → If found: use existing user
  → If not found: create new user (requires phone + card)
```

The `userId` field is set by the `POST /purchase/existing` route handler, which extracts it from `c.get("user").user_id` after `authMiddleware` runs.

---

## Verification

1. **`POST /purchase/new`** — submit new user fields; verify user created, subscription created, `_api_token` cookie set, `userCreated: true`
2. **`POST /purchase/existing` with cookie** — set `_api_token` cookie, submit only `product_id`; verify no user created, subscription created for session user, `userCreated: false`
3. **`POST /purchase/existing` with header** — send `x-api-token: <token>` header; same result as above
4. **`POST /purchase/existing` without auth** — verify 401
5. **`POST /purchase/existing` with new card** — include card fields; verify new card used for payment
6. **Schema enforcement** — send `POST /purchase/new` without `phone`; verify 400 at schema level
