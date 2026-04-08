# QA Test Plan — Go-Live Migration

Complete walkthrough of every system process, its lifecycle, edge cases, and how to test each step. Designed so a developer can work through every item sequentially and have full confidence that every case is accounted for.

> **Definitive reference:** [Billing Scenario Matrix](../business/capabilities/billing-scenario-matrix.md) — all product types, state combinations, lifecycle events, and edge cases.

## Progress: 100% complete (23 / 23 active sections verified)

| Status      | Count | Sections           |
| ----------- | ----- | ------------------ |
| VERIFIED    | 23    | 1–15, 17–23, 26b  |
| SHELVED     | 3     | 3b, 16, 26         |

> **3 shelved sections** (free trial related) are excluded from the active count. Un-shelve them when the free trial UI is ready.

## Prerequisites

```bash
# Dev server running
yarn dev

# Dev tools CLI available
yarn dev:tools

# Verify system is healthy
yarn dev:tools system

# Verify all products & subscriptions match expected configuration
yarn dev:tools verify

# Generate an auth link to test /manage routes for any user
yarn dev:tools auth-link <user_id>
```

---

## Table of Contents

1. New User Purchase: `premium_cashoffers` — `VERIFIED`
2. Existing User Enrollment: `external_cashoffers` — `VERIFIED`
3. New User Purchase: `homeuptick_only` (Paid, No Free Trial) — `VERIFIED`
   3b. New User Purchase: `homeuptick_only` (Free Trial) — `SHELVED`
4. New User Signup (Free) — `VERIFIED`
5. New User Signup (Investor) — `VERIFIED`
6. New User Signup (Team Plan) — `VERIFIED`
7. Whitelabel Signup — `VERIFIED`
8. Subscription Renewal: `premium_cashoffers` (Combined CO+HU) — `VERIFIED`
9. Subscription Renewal: `external_cashoffers` — `VERIFIED`
10. Subscription Renewal: `homeuptick_only` — `VERIFIED`
11. Payment Failure — User-Fault (Card Declined) — `VERIFIED`
12. Payment Failure — System-Fault (HU API / Square Down) — `VERIFIED`
13. Suspension After Max Retries — `VERIFIED`
14. Cancel on Renewal — `VERIFIED`
15. Downgrade on Renewal (`premium_cashoffers` → Free) — `VERIFIED`
16. Free Trial: `homeuptick_only` Lifecycle — `SHELVED`
17. Pause (CO Deactivation via Webhook) — `VERIFIED`
18. Resume (CO Reactivation via Webhook) — `VERIFIED`
19. Card Update — `VERIFIED`
20. Plan Change (Upgrade) — `VERIFIED`
21. Plan Change (Downgrade) — `VERIFIED`
22. Payment Refund — `VERIFIED`
23. Property Unlock — `VERIFIED`
24. Cron: Trial Warning & Expiration — `SHELVED`
    26b. Manage Billing: Premium User Without Subscription — `VERIFIED`

---

## Status Legend

Each section has a status indicator reflecting where we are with it:

| Status          | Meaning                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| **VERIFIED**    | Docs accurate, implementation correct, tested and working                  |
| **IN-PROGRESS** | Implementation in progress — not yet verified                              |
| **SHELVED**     | Intentionally deferred — skip during QA, do not implement until un-shelved |

---

## Key Concepts

Before testing, understand these distinctions from the [Billing Scenario Matrix](../business/capabilities/billing-scenario-matrix.md):

| Concept                                   | Definition                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Product categories**                    | `premium_cashoffers` (CO Premium, managed=true). `external_cashoffers` (HU standalone, managed=false). `homeuptick_only` (HU + HOMEUPTICK CO, card required) — explicit `product_category` column on Products table. See [Product Categories](../business/decisions/product-categories.md) |
| **`managed` flag**                        | `true` = billing controls CO access. `false` = CO is external, billing only manages HU                                                                                                                                                                                                |
| **HOMEUPTICK role**                       | Active HU-only CO access. Assigned to `homeuptick_only` subscribers. Designates billing is active but user only has HomeUptick access                                                                                                                                                  |
| **SHELL role**                            | Deactivated CO access. Set on subscription suspension/deactivation (DEACTIVATE_USER). Exists solely so HU login works (HU auth depends entirely on CO)                                                                                                                                |
| **Paused vs Suspended**                   | **Paused** = admin/webhook deactivated CO account. **Suspended** = max payment retries exhausted. Different card-update behaviors                                                                                                                                                     |
| **Combined charging**                     | CO and HU always charged together. If HU API is down at renewal, do NOT charge CO — retry the whole thing                                                                                                                                                                             |
| **Non-user-fault failures**               | HU API down, Square outage → do NOT increment `payment_failure_count`. Retry without penalty                                                                                                                                                                                          |
| **Auto-trial vs `homeuptick_only` trial** | Auto-trial = HU-driven, no billing, no card. `homeuptick_only` with free trial (WIP) = billing-managed, card required, auto-converts to paid. `homeuptick_only` without free trial = paid from day one, card charged immediately                                                      |
| **Whitelabel suspension**                 | `DEACTIVATE_USER` → role=SHELL. `DOWNGRADE_TO_FREE` → is_premium=0, role unchanged. SHELL always preserved                                                                                                                                                                            |

---

## 1. New User Purchase: `premium_cashoffers` — `VERIFIED`

**Scenario matrix refs:** P1

**Process:** New user purchases CO Premium subscription. CO access = premium. HU base 500 contacts included (no separate charge). HU usage-based tiers auto-applied if >500 contacts.

### Lifecycle

| Step                            | What Happens                         | Verify                                                   |
| ------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| 1. Land on pricing page         | Products load filtered by whitelabel | Products display with correct prices                     |
| 2. Click "Sign Up" on a product | Navigates to subscribe flow          | URL is `/{whitelabel}/subscribe/{product}`               |
| 3. Enter email                  | System checks if user exists         | New user proceeds; existing user gets reactivation offer |
| 4. Enter name, slug, phone      | Standard validation                  | Fields captured                                          |
| 5. Enter card details           | Square tokenizes card in browser     | Card nonce generated (no PCI data hits server)           |
| 6. Review & accept terms        | All consents displayed               | TOS, general, communication checkboxes required          |
| 7. Submit                       | Backend processes purchase           | See backend steps below                                  |
| 8. Welcome screen               | Success confirmation                 | User directed to set password                            |

**Backend steps on submit (POST `/api/purchase/new`):**

| Step | What Happens                                       | Verify                                                  |
| ---- | -------------------------------------------------- | ------------------------------------------------------- |
| A    | Validate product exists, active, `managed=true`    | Invalid product → 400                                   |
| B    | Create card in Square with null user_id            | Card created in Square                                  |
| C    | Charge signup fee via Square                       | Transaction logged, amount matches product `signup_fee` |
| D    | Create user in main API with `user_config`         | User: correct role, `is_premium=1`, whitelabel          |
| E    | Bind card to new user                              | UserCards links user_id to card_id                      |
| F    | Create subscription record                         | Status: `active`, `next_renewal_at` = now + duration    |
| G    | Seed HomeUptick subscription from product template | `Homeuptick_Subscriptions` row created                  |
| H    | Emit SubscriptionCreated event                     | Premium activation fires                                |
| I    | Send confirmation email                            | Email received                                          |

### Edge Cases

| Case                                     | Expected Behavior                          | Matrix Ref |
| ---------------------------------------- | ------------------------------------------ | ---------- |
| Card declined                            | Error shown, user can retry                | —          |
| Payment succeeds but user creation fails | No refund; admin alerted; customer emailed | —          |
| Duplicate email                          | "Account exists" with reactivation offer   | —          |

### How to Test

**Frontend (manual):**

1. Navigate to `http://localhost:3000` (or `http://localhost:3000/{whitelabel}`)
2. Click "Sign Up" on a paid CO product
3. Walk through each step
4. Use `?mock_purchase=true` to skip real Square charges
5. Verify welcome screen appears

**Dev CLI:**

```bash
yarn dev:tools scenario renewal-due --email test-pco@dev-test.local
yarn dev:tools state <user_id>
# Verify: managed=true, is_premium=1, HU base included
```

**Integration test:**

```bash
yarn test api/tests/integration/cashoffers-module.test.ts
yarn test --config vitest.config.api.ts api/tests/integration/homeuptick-default-seeding.test.ts
```

---

## 2. Existing User Enrollment: `external_cashoffers` — `VERIFIED`

**Scenario matrix refs:** P2, P7

**Process:** Existing premium user whose CO is managed externally (KW agents, team members) enrolls in HU standalone via the manage flow. `managed=false` — billing never touches CO account. **These products are NOT available on the main signup flow** — they are purchased via `POST /api/purchase/existing` through the manage billing section.

### Lifecycle

| Step                                                      | What Happens                                                        | Verify                   |
| --------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------ |
| 1. User navigates to `/manage`                            | Logs in with existing CO credentials                                | Dashboard loads          |
| 2. System detects `is_premium=1`, no billing subscription | `GET /manage/enrollment` returns `external_cashoffers` products     | Correct category shown   |
| 3. User selects `external_cashoffers` product             | Product has `managed=false`, `product_category=external_cashoffers` | Billing won't control CO |
| 4. Card entry + submit                                    | `POST /api/purchase/existing`                                       | Card nonce generated     |
| 5. Charge via Square                                      | HU-only charge (typically $0 base + overages)                       | No CO charge component   |
| 6. Subscription created                                   | `managed=false`, HU data = Paid-Active                              | CO untouched             |
| 7. HomeUptick subscription seeded                         | `Homeuptick_Subscriptions` row created                              | HU config set            |

### Edge Cases

| Case                                 | Expected Behavior                                                           | Matrix Ref |
| ------------------------------------ | --------------------------------------------------------------------------- | ---------- |
| KW/team member purchases             | `managed=false`; CO external                                                | P7         |
| User already has active subscription | `GET /manage/enrollment` returns 409 (not eligible)                         | —          |
| User already has P-CO                | Should not be offered `external_cashoffers` (already has HU via CO premium) | —          |
| CO deactivated later                 | Webhook pauses subscription; HU access frozen                               | PZ2        |
| User is not premium (`is_premium=0`) | `GET /manage/enrollment` returns `homeuptick_only` products instead         | —          |

### How to Test

**Dev CLI:**

```bash
# Create a premium user with no billing subscription
yarn dev:tools scenario premium-no-sub --email test-phu@dev-test.local

# Generate an auth link for the manage flow
yarn dev:tools auth-link <user_id>

# Open the auth link in browser → lands on /manage dashboard
# Enrollment should show external_cashoffers products
# Complete the enrollment flow

# Verify state after enrollment
yarn dev:tools state <user_id>
# Verify: managed=false, CO untouched, HU subscription created
```

**Manual (manage flow):**

1. `yarn dev:tools scenario premium-no-sub` → creates premium user with no sub
2. `yarn dev:tools auth-link <user_id>` → generates manage URL
3. Open URL in browser → enrollment shows `external_cashoffers` products
4. Complete purchase
5. Verify: `yarn dev:tools state <user_id>` shows managed=false, HU active

---

## 3. New User Purchase: `homeuptick_only` (Paid, No Free Trial) — `VERIFIED`

**Scenario matrix refs:** P3 (variant: no free trial)

**Process:** New user purchases a `homeuptick_only` product that has no free trial configured. Card required. Charged immediately (signup fee). CO access = HOMEUPTICK (managed=true, is_premium=0, role=HOMEUPTICK). HU = Paid-Active from day one.

### Lifecycle

| Step                     | What Happens                                          | Verify                                                                    |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| 1. Land on pricing page  | `homeuptick_only` products displayed (no trial badge) | Correct price shown, no trial language                                    |
| 2. Click "Sign Up"       | Navigates to subscribe flow                           | URL is `/{whitelabel}/subscribe/{product}`                                |
| 3. Enter email           | System checks if user exists                          | New user proceeds; existing user gets reactivation offer                  |
| 4. Enter name, phone     | Standard validation                                   | Fields captured (no slug step — HOMEUPTICK users don't get lead capture pages) |
| 5. Enter card details    | Square tokenizes card in browser                      | Card nonce generated                                                      |
| 6. Review & accept terms | All consents displayed                                | TOS, general, communication checkboxes required                           |
| 7. Submit                | Backend processes purchase                            | See backend steps below                                                   |
| 8. Welcome screen        | Success confirmation                                  | User directed to set password                                             |

**Backend steps on submit (POST `/api/purchase/new`):**

| Step | What Happens                                                                        | Verify                                                                       |
| ---- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A    | Validate product exists, active, `managed=true`, `product_category=homeuptick_only` | Invalid product → 400                                                        |
| B    | Create card in Square with null user_id                                             | Card created in Square                                                       |
| C    | Charge signup fee via Square                                                        | Transaction logged, amount matches product `signup_fee`                      |
| D    | Create user in main API with `user_config`                                          | User: role=HOMEUPTICK, `is_premium=0`, whitelabel set                        |
| E    | Bind card to new user                                                               | UserCards links user_id to card_id                                           |
| F    | Create subscription record                                                          | Status: `active`, `next_renewal_at` = now + duration, **no** `trial_ends_at` |
| G    | Seed HomeUptick subscription from product template                                  | `Homeuptick_Subscriptions` row created, HU = Paid-Active                     |
| H    | Emit SubscriptionCreated event                                                      | HU activation fires                                                          |
| I    | Send confirmation email                                                             | Email received                                                               |

### Edge Cases

| Case                                                              | Expected Behavior                             | Matrix Ref   |
| ----------------------------------------------------------------- | --------------------------------------------- | ------------ |
| Card declined                                                     | Error shown, user can retry                   | —            |
| User had HU auto-trial                                            | Clear auto-trial; paid HU takes over          | P6 (variant) |
| Duplicate email                                                   | "Account exists" with reactivation offer      | —            |
| Product has `free_trial.enabled = false` or no `free_trial` block | Treated as paid from day one — no trial logic | —            |

### How to Test

**Frontend (manual):**

1. Navigate to `http://localhost:3000/{whitelabel}` with a `homeuptick_only` product that has no free trial
2. Click "Sign Up" on the product
3. Walk through each step — card required, no trial messaging shown
4. Use `?mock_purchase=true` to skip real Square charges
5. Verify welcome screen appears

**Dev CLI:**

```bash
yarn dev:tools scenario renewal-due --product p-hu-notrial --email test-hu-paid@dev-test.local
yarn dev:tools state <user_id>
# Verify: managed=true, is_premium=0, role=HOMEUPTICK, HU=Paid-Active, no trial_ends_at, card on file
```

**Integration test:**

```bash
yarn test api/tests/integration/homeuptick-default-seeding.test.ts
```

---

## 3b. New User Purchase: `homeuptick_only` (Free Trial) — `SHELVED`

> **WIP — Not included in initial release.** Billing-managed free trials are not ready for production. The signup UI does not properly communicate trial terms. Do not configure `free_trial` on any products until this feature is complete.

**Scenario matrix refs:** P3, P6

**Process:** User enrolls in billing-managed HU free trial. Card required upfront. Auto-converts to paid HU at `trial_ends_at`. CO access = HOMEUPTICK (active HU-only access, allows HU login).

### Lifecycle

| Step                                  | What Happens                              | Verify                                   |
| ------------------------------------- | ----------------------------------------- | ---------------------------------------- |
| 1. User selects P-TRIAL               | Product requires card                     | Card form displayed                      |
| 2. Card entry                         | Square tokenizes                          | Card stored for auto-conversion          |
| 3. Submit                             | No charge during trial                    | Transaction amount = 0 or no transaction |
| 4. Subscription created               | Status: `free_trial`, `trial_ends_at` set | CO = HOMEUPTICK, HU = Trial-Active       |
| 5. **Clear HU auto-trial** if present | P-TRIAL replaces auto-trial               | Auto-trial removed                       |

### Edge Cases

| Case                             | Expected Behavior                                | Matrix Ref |
| -------------------------------- | ------------------------------------------------ | ---------- |
| User had HU auto-trial           | Clear auto-trial; P-TRIAL takes over             | P6         |
| User purchases P-CO during trial | End trial early; upgrade to P-CO                 | P4         |
| CO deactivated during trial      | Trial paused; `trial_ends_at` extended on resume | PZ3        |
| Cancel during trial              | `cancel_on_renewal` → no conversion at trial end | X3         |

### How to Test

**Dev CLI:**

```bash
yarn dev:tools scenario trial-expired --product p-trial --email test-ptrial@dev-test.local
yarn dev:tools state <user_id>
# Verify: status=free_trial, CO=HOMEUPTICK, HU=Trial-Active, trial_ends_at set, card on file
```

---

## 4. New User Signup (Free) — `VERIFIED`

**Process:** New user creates a free account (no payment required).

### Lifecycle

| Step                    | What Happens                            | Verify                                     |
| ----------------------- | --------------------------------------- | ------------------------------------------ |
| 1. Select free product  | Card step skipped                       | No Square form                             |
| 2. Complete form        | Standard validation                     | Fields captured                            |
| 3. Submit               | POST `/api/purchase/new` (no card)      | No payment                                 |
| 4. User created         | `user_config` from free product applied | Role per product, `is_premium` per product |
| 5. Subscription created | Status: `active`, amount: 0             | No renewal charges                         |

### How to Test

**Frontend:**

1. Navigate to `http://localhost:3000/{whitelabel}/subscribe/{free_product_id}`
2. Complete form — card step skipped
3. Verify subscription amount=0: `yarn dev:tools state <user_id>`

---

## 5. New User Signup (Investor) — `VERIFIED`

Same as [P-CO purchase](#1-new-user-purchase-p-co-co-premium) with:

| Difference         | Detail                                           |
| ------------------ | ------------------------------------------------ |
| Entry point        | `/investor` or product with investor role        |
| Additional consent | Investor-specific checkbox on review step        |
| Role               | `user_config.role` = `INVESTOR`                  |
| Slug step          | Skipped (investors don't get lead capture pages) |

### Edge Cases

| Case                                   | Expected Behavior                             |
| -------------------------------------- | --------------------------------------------- |
| Investor tries to switch to AGENT plan | Role incompatibility — blocked by `checkplan` |
| AGENT tries to switch to investor plan | Role incompatibility — blocked                |

---

## 6. New User Signup (Team Plan) — `VERIFIED`

Same as [P-CO purchase](#1-new-user-purchase-p-co-co-premium) with:

| Difference  | Detail                             |
| ----------- | ---------------------------------- |
| Product     | `is_team_plan: true`               |
| Role        | `user_config.role` = `TEAMOWNER`   |
| Team step   | Additional "Team Name" step        |
| Broker step | May appear depending on whitelabel |

### Edge Cases

| Case                              | Expected Behavior                    |
| --------------------------------- | ------------------------------------ |
| Team plan → single plan downgrade | Role changes to AGENT (role mapping) |
| Single plan → team plan upgrade   | Role changes to TEAMOWNER            |

---

## 7. Whitelabel Signup — `VERIFIED`

**Process:** Partner-branded signup flow with whitelabel-specific products and branding.

### Lifecycle

| Step                                | What Happens                              | Verify                             |
| ----------------------------------- | ----------------------------------------- | ---------------------------------- |
| 1. Navigate to `/{whitelabel_code}` | Whitelabel branding loads                 | Correct logo, colors, partner name |
| 2. Products filtered                | Only products for this whitelabel shown   | Products match whitelabel config   |
| 3. Signup flow                      | Standard flow with branding               | `white_label_id` set on user       |
| 4. Emails                           | Whitelabel templates used (if configured) | Partner branding in email          |

### Edge Cases

| Case                        | Expected Behavior                                          |
| --------------------------- | ---------------------------------------------------------- |
| Invalid whitelabel code     | **404 — no products shown, landing/signup pages show 404** |
| Whitelabel with no products | **404 — same as invalid whitelabel**                       |
| Missing email template      | Falls back to default template                             |

**Known whitelabel codes:** `kwofferings`, `yhs`, `uco`, `mop`, `eco`, `platinum`

---

## 8. Subscription Renewal: `premium_cashoffers` (Combined CO+HU) — `VERIFIED`

**Scenario matrix refs:** R1, R5, R6

**Process:** Cron finds P-CO subscription due for renewal. Charges **combined** CO base + HU usage in a single payment. HU contact count fetched from HU API at charge time.

### Lifecycle

| Step                                      | What Happens                                    | Verify                           |
| ----------------------------------------- | ----------------------------------------------- | -------------------------------- |
| 1. Cron triggered                         | POST `/api/cron/subscriptions` with CRON_SECRET | Endpoint responds 200            |
| 2. Query due subscriptions                | `next_renewal_at <= now` AND status = `active`  | Correct subscriptions found      |
| 3. Check user active in main API          | Fetches user                                    | Active proceed, inactive skipped |
| 4. Check cancel/downgrade flags           | Neither flag set                                | Proceeds to charge               |
| 5. **Fetch HU contact count from HU API** | GET client count from HomeUptick                | Count returned                   |
| 6. **Calculate combined charge**          | CO base + HU usage-based tier                   | Amount = CO base + HU tier cost  |
| 7. Charge via Square                      | Single combined payment                         | Transaction logged as "renewal"  |
| 8. Update next_renewal_at                 | now + duration                                  | Date advanced                    |
| 9. Reset payment_failure_count            | Set to 0                                        | Clean slate                      |
| 10. Send renewal email                    | Receipt shows CO base + HU usage breakdown      | Email with line items            |

### Edge Cases

| Case                                        | Expected Behavior                                                                              | Matrix Ref |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------- |
| **HU API unavailable**                      | **Do NOT charge CO.** Do not increment `payment_failure_count`. Schedule retry without penalty | R5         |
| User has ≤500 contacts                      | HU usage = $0 (base included with CO premium)                                                  | R1         |
| User has >500 contacts                      | HU usage charge based on tier                                                                  | P8         |
| User inactive in main API                   | Subscription skipped (no charge)                                                               | —          |
| HU contact count changed since last renewal | New tier automatically applied                                                                 | P8         |

### How to Test

**Dev CLI:**

```bash
# Create P-CO subscription due for renewal
# (seeds Homeuptick_Subscriptions with base_contacts=500, $75/tier, 500 contacts/tier)
yarn dev:tools scenario renewal-due
```

**Before triggering renewal:** the user must log into HomeUptick to establish the API connection (this sets the `api_token` on the user record). Without this step, the HU API call will fail with a 401.

```bash
# 1. Log in as the user at http://localhost:3000/manage
#    Email: <email from scenario output>  Password: test123
#
# 2. Navigate to HomeUptick and log in / connect the account
#    This creates the api_token that the billing system uses to
#    fetch their contact count from the HU API.
#
# 3. Create at least one contact in HomeUptick so the HU usage component is non-zero

# 4. Trigger renewal
yarn dev:tools cron-run <user_id>
yarn dev:tools state <user_id>
# Verify: combined charge amount, HU usage component, next_renewal_at advanced
```

**Integration test:**

```bash
yarn test api/tests/integration/cashoffers-module.test.ts
yarn test api/tests/integration/renewal-homeuptick-tiers.test.ts
```

---

## 9. Subscription Renewal: `external_cashoffers` — `VERIFIED`

**Scenario matrix ref:** R2

**Process:** P-HU subscription renews. HU-only charge based on contact count. CO untouched.

### Lifecycle

| Step                      | What Happens                | Verify              |
| ------------------------- | --------------------------- | ------------------- |
| 1. Fetch HU contact count | From HU API                 | Count returned      |
| 2. Calculate charge       | Usage-based HU tier pricing | Correct tier amount |
| 3. Charge via Square      | HU-only payment             | Single transaction  |
| 4. Update next_renewal_at | now + duration              | Date advanced       |
| 5. CO untouched           | `managed=false`             | No CO state changes |

### Edge Cases

| Case                            | Expected Behavior                                       | Matrix Ref |
| ------------------------------- | ------------------------------------------------------- | ---------- |
| HU API unavailable              | Do not charge. Retry without incrementing failure count | R5         |
| Tier changed since last renewal | New tier cost applied                                   | P8         |

### How to Test

```bash
yarn dev:tools scenario renewal-due --product p-hu
```

**Before triggering renewal:** log in as the user and connect to HomeUptick (sets the `api_token`). Create contacts to test tier pricing.

```bash
# 1. Log in at http://localhost:3000/manage
#    Email: <email from scenario output>  Password: test123
# 2. Navigate to HomeUptick → log in / connect account
# 3. Create contacts in HomeUptick

# 4. Trigger renewal
yarn dev:tools cron-run <user_id>
yarn dev:tools state <user_id>
```

**Integration test:**

```bash
yarn test api/tests/integration/homeuptick-module.test.ts
```

---

## 10. Subscription Renewal: `homeuptick_only` — `VERIFIED`

**Scenario matrix refs:** R3

**Process:** Cron finds `homeuptick_only` subscription due for renewal. Charges HU usage-based amount based on contact count fetched from HU API. CO stays HOMEUPTICK — no CO state changes.

### Lifecycle

| Step                           | What Happens                                    | Verify                     |
| ------------------------------ | ----------------------------------------------- | -------------------------- |
| 1. Cron triggered              | POST `/api/cron/subscriptions` with CRON_SECRET | Endpoint responds 200      |
| 2. Query due subscriptions     | `next_renewal_at <= now` AND status = `active`  | Correct subscription found |
| 3. Fetch HU contact count      | From HU API                                     | Count returned             |
| 4. Calculate charge            | Usage-based HU tier pricing                     | Correct tier amount        |
| 5. Charge via Square           | HU-only payment                                 | Single transaction         |
| 6. Update next_renewal_at      | now + duration                                  | Date advanced              |
| 7. Reset payment_failure_count | Set to 0                                        | Clean slate                |
| 8. Send renewal email          | Receipt shows HU usage breakdown                | Email sent                 |
| 9. CO stays HOMEUPTICK         | No change to CO access                          | HOMEUPTICK preserved       |

### Edge Cases

| Case                            | Expected Behavior                                       | Matrix Ref |
| ------------------------------- | ------------------------------------------------------- | ---------- |
| HU API unavailable              | Do not charge. Retry without incrementing failure count | R5         |
| Tier changed since last renewal | New tier cost applied                                   | —          |
| `cancel_on_renewal` set         | Do not renew. HU access off. HOMEUPTICK → SHELL on cancel | —          |
| User inactive in main API       | Subscription skipped (no charge)                        | —          |

### How to Test

**Dev CLI:**

```bash
# Create homeuptick_only subscription due for renewal
# (seeds Homeuptick_Subscriptions with base_contacts=0, $75/tier, 500 contacts/tier)
yarn dev:tools scenario renewal-due --product p-trial
```

**Before triggering renewal:** log in as the user and connect to HomeUptick (sets the `api_token`). Since `base_contacts=0`, even one contact triggers tier charges.

```bash
# 1. Log in at http://localhost:3000/manage
#    Email: <email from scenario output>  Password: test123
# 2. Navigate to HomeUptick → log in / connect account
# 3. Create at least one contact so the tier charges apply

# 4. Trigger renewal
yarn dev:tools cron-run <user_id>
yarn dev:tools state <user_id>
# Verify: HU usage charge, next_renewal_at advanced, HOMEUPTICK preserved
```

**Integration test:**

```bash
yarn test api/tests/integration/homeuptick-module.test.ts
```

---

## 11. Payment Failure — User-Fault (Card Declined) — `VERIFIED`

**Scenario matrix refs:** F1, F5, F6

**Process:** Renewal payment fails due to user-fault (card declined, insufficient funds, expired card). System increments `payment_failure_count` and schedules retry.

### Retry Schedule

| `payment_failure_count` | Wait Before Retry | Next Action                                        |
| ----------------------- | ----------------- | -------------------------------------------------- |
| 1                       | +1 day            | Retry                                              |
| 2                       | +3 days           | Retry                                              |
| 3                       | +7 days           | Retry                                              |
| 4                       | **Suspend**       | See [Suspension](#13-suspension-after-max-retries) |

### Lifecycle

| Step                                     | What Happens                                  | Verify                      |
| ---------------------------------------- | --------------------------------------------- | --------------------------- |
| 1. Renewal attempted                     | Square charge fails (user-fault)              | PaymentFailed event emitted |
| 2. **Increment `payment_failure_count`** | Count goes up by 1                            | Counter updated in DB       |
| 3. Failure logged                        | Transaction record with failure status        | Transaction visible         |
| 4. Failure email sent                    | User notified of failed payment               | Email sent                  |
| 5. Retry scheduled                       | `next_renewal_at` set per retry schedule      | Date set correctly          |
| 6. Next cron run                         | Picks up subscription when retry window opens | Retry attempted             |

### Edge Cases

| Case                               | Expected Behavior                                                         | Matrix Ref |
| ---------------------------------- | ------------------------------------------------------------------------- | ---------- |
| Card updated during retry window   | Next retry uses new card                                                  | F5         |
| CO deactivated during retry window | **Pause stops retries.** Retry resumes from same position on reactivation | F6         |
| User cancels during retry          | `cancel_on_renewal` respected                                             | —          |

### How to Test

```bash
# First failure (triggers retry-1)
yarn dev:tools scenario payment-failure
yarn dev:tools cron-run <user_id>
yarn dev:tools state <user_id>
# Verify: payment_failure_count=1, next retry in ~1 day

# Walk full escalation
yarn dev:tools scenario payment-failure
yarn dev:tools cron-run <user_id>                              # 1st fail → +1d
yarn dev:tools set-state <sub_id> next_renewal_attempt=2020-01-01T00:00:00Z
yarn dev:tools cron-run <user_id>                              # 2nd fail → +3d
yarn dev:tools set-state <sub_id> next_renewal_attempt=2020-01-01T00:00:00Z
yarn dev:tools cron-run <user_id>                              # 3rd fail → +7d
yarn dev:tools set-state <sub_id> next_renewal_attempt=2020-01-01T00:00:00Z
yarn dev:tools cron-run <user_id>                              # 4th fail → SUSPEND

# Card update recovery
yarn dev:tools scenario payment-retry-1
yarn dev:tools break-card <user_id>
yarn dev:tools cron-run <user_id>                              # Fails with bad card
yarn dev:tools fix-card <user_id>
yarn dev:tools set-state <sub_id> next_renewal_attempt=2020-01-01T00:00:00Z
yarn dev:tools cron-run <user_id>                              # Succeeds with good card

# Pre-built retry states (valid cards — break-card to make fail)
yarn dev:tools scenario payment-retry-1   # 1 prior failure
yarn dev:tools scenario payment-retry-2   # 2 prior failures
yarn dev:tools scenario payment-retry-3   # 3 prior failures, next fail → suspend
```

**Integration test:**

```bash
yarn test api/tests/integration/retry-and-suspension.test.ts
yarn test api/tests/integration/card-update-retry.test.ts
```

---

## 12. Payment Failure — System-Fault (HU API / Square Down) — `VERIFIED`

**Scenario matrix refs:** F2, R5, R6

**Process:** Renewal fails due to non-user-fault (HU API unavailable, Square outage). System does **NOT** increment `payment_failure_count`. Retries at the same interval position.

### Lifecycle

| Step                                            | What Happens                           | Verify                         |
| ----------------------------------------------- | -------------------------------------- | ------------------------------ |
| 1. Renewal attempted                            | Fails due to system issue              | Error logged                   |
| 2. **Do NOT increment `payment_failure_count`** | Counter stays the same                 | DB unchanged                   |
| 3. Schedule retry                               | Same interval position (not escalated) | Retry without penalty          |
| 4. No user-facing failure email                 | System issue, not user's fault         | No email (or admin alert only) |

### Key Distinction

| Failure Type                 | `payment_failure_count` | Retry Interval        | Email            |
| ---------------------------- | ----------------------- | --------------------- | ---------------- |
| Card declined (user-fault)   | Incremented             | Escalating (1d→3d→7d) | User notified    |
| HU API down (system-fault)   | **Not incremented**     | Same position         | Admin alert only |
| Square outage (system-fault) | **Not incremented**     | Same position         | Admin alert only |

### Edge Cases

| Case                            | Expected Behavior                                                | Matrix Ref |
| ------------------------------- | ---------------------------------------------------------------- | ---------- |
| HU API down for P-CO renewal    | Do not charge CO either. Retry whole thing                       | R5         |
| HU API down for P-HU renewal    | Do not charge. Retry without penalty                             | R5         |
| Square outage mid-charge        | Same — no failure count increment                                | R6         |
| HU API down for extended period | Retries continue without count increment. Future: admin override | E9         |

### How to Test

This requires mocking infrastructure failures:

```bash
# Mock HU API unavailability (implementation-specific)
# Verify: payment_failure_count unchanged after retry
# Verify: retry scheduled at same interval, not escalated
# Verify: no user-facing failure email sent
```

**Integration test:**

```bash
yarn test api/tests/integration/renewal-homeuptick-tiers.test.ts
# Verify system-fault handling in test cases
```

---

## 13. Suspension After Max Retries — `VERIFIED`

**Scenario matrix refs:** F3, F4

**Process:** After 4th user-fault payment failure, subscription is suspended. Behavior differs by product type and whitelabel.

### P-CO Suspension (F3)

| Whitelabel Behavior | CO Result                                     | HU Result     |
| ------------------- | --------------------------------------------- | ------------- |
| `DEACTIVATE_USER`   | Role → **SHELL** (zero features, keeps login) | HU access off |
| `DOWNGRADE_TO_FREE` | `is_premium=0`, role unchanged                | HU access off |

**In both cases:** SHELL access preserved — user keeps portal login.

### P-HU Suspension (F4)

| Result                                 | Detail                                     |
| -------------------------------------- | ------------------------------------------ |
| HU access off                          | Paid-Suspended                             |
| CO untouched                           | `managed=false` — billing doesn't touch CO |
| User keeps whatever CO access they had | External CO unaffected                     |

### Lifecycle

| Step                            | What Happens                                | Verify                      |
| ------------------------------- | ------------------------------------------- | --------------------------- |
| 1. 4th payment failure          | Max retries exhausted                       | `payment_failure_count` = 4 |
| 2. Status → `suspended`         | `suspension_date` set                       | Cron stops attempting       |
| 3. CO configured per whitelabel | SHELL or is_premium=0 (P-CO only)           | User config updated         |
| 4. HU access revoked            | HU data → Paid-Suspended                    | HU off                      |
| 5. Suspension email sent        | User notified with card update instructions | Email sent                  |
| 6. **SHELL preserved**          | User can still log in to portal             | Role not removed            |

### Edge Cases

| Case                                      | Expected Behavior                                  | Matrix Ref |
| ----------------------------------------- | -------------------------------------------------- | ---------- |
| Card update on suspended sub              | Trigger immediate payment. On success → reactivate | F7, E6     |
| Card update fails on suspended sub        | Remains suspended, counts as another retry         | E6         |
| P-CO user >500 HU contacts then suspended | HU access off entirely (no CO premium = no base)   | E2         |

### How to Test

```bash
# Walk to suspension
yarn dev:tools scenario payment-retry-3
yarn dev:tools break-card <user_id>
yarn dev:tools set-state <sub_id> next_renewal_attempt=2020-01-01T00:00:00Z
yarn dev:tools cron-run <user_id>

yarn dev:tools state <user_id>
# Verify: status=suspended, suspension_date set
# Verify: CO per whitelabel behavior (SHELL or is_premium=0)
# Verify: HU access off
# Verify: SHELL role preserved

# Card update reactivation
yarn dev:tools fix-card <user_id>
# Trigger card update → immediate payment attempt
yarn dev:tools state <user_id>
# Verify: if payment succeeded → status=active, access restored
```

**Integration test:**

```bash
yarn test api/tests/integration/retry-and-suspension.test.ts
```

---

## 14. Cancel on Renewal — `VERIFIED`

**Scenario matrix refs:** X1, X2, X3

**Process:** User marks subscription for cancellation. At period end (or trial end), subscription cancelled instead of renewed/converted.

### Behavior by Product Type

| Product | At Period/Trial End                 | CO Result                              | HU Result     | Matrix Ref |
| ------- | ----------------------------------- | -------------------------------------- | ------------- | ---------- |
| P-CO    | Cancel at renewal                   | Per whitelabel (SHELL or is_premium=0) | HU access off | X1         |
| P-HU    | Cancel at renewal                   | CO untouched (external)                | HU access off | X2         |
| P-TRIAL | Cancel at trial end (no conversion) | SHELL preserved                        | HU access off | X3         |

**In all cases:** SHELL access preserved — user keeps portal login.

### Lifecycle

| Step                                    | What Happens                | Verify                      |
| --------------------------------------- | --------------------------- | --------------------------- |
| 1. User requests cancellation           | `cancel_on_renewal = true`  | Flag set                    |
| 2. Access continues                     | Until period/trial end      | Status still active         |
| 3. Cron at renewal/trial end            | Detects `cancel_on_renewal` | Skips charge/conversion     |
| 4. Subscription deactivated             | Status → `inactive`         | No payment processed        |
| 5. CO configured per product/whitelabel | See table above             | User config updated         |
| 6. Cancellation email                   | User notified               | Email confirms cancellation |

### Edge Cases

| Case                       | Expected Behavior                                   |
| -------------------------- | --------------------------------------------------- |
| Uncancel before renewal    | `cancel_on_renewal` cleared, normal renewal resumes |
| Cancel during retry window | Cancel takes precedence over retry                  |
| Cancel P-TRIAL             | No conversion at trial end; HU off; SHELL preserved |

### How to Test

```bash
yarn dev:tools scenario cancel-on-renewal
yarn dev:tools cron-preview
yarn dev:tools cron-run <user_id>
yarn dev:tools state <user_id>
# Verify: status=inactive, CO per whitelabel, HU off, SHELL preserved

# Uncancel
yarn dev:tools set-state <sub_id> cancel_on_renewal=false
```

**Integration test:**

```bash
yarn test api/tests/integration/cashoffers-module.test.ts
```

---

## 15. Downgrade on Renewal (`premium_cashoffers` → Free) — `VERIFIED`

**Scenario matrix ref:** D1

**Process:** P-CO user's subscription reaches renewal. Whitelabel config determines whether cancellation results in a downgrade (to free tier) or a full cancellation. At renewal: CO → free, HU base 500 removed, HU access off.

### Lifecycle

| Step                          | What Happens                                       | Verify                      |
| ----------------------------- | -------------------------------------------------- | --------------------------- |
| 1. `cancel_on_renewal = true` | User cancels subscription                          | Flag set                    |
| 2. Cron at renewal            | Detects cancel flag                                | Skips normal renewal charge |
| 3. Check whitelabel config    | Whitelabel determines downgrade vs cancel behavior | Correct path taken          |
| 4. CO downgraded              | `is_premium=0`                                     | Premium access removed      |
| 5. HU base removed            | Was included with CO premium                       | HU access off entirely      |
| 6. Downgrade email            | User notified                                      | —                           |

### Edge Cases

| Case                                          | Expected Behavior                                              | Matrix Ref |
| --------------------------------------------- | -------------------------------------------------------------- | ---------- |
| P-CO user >500 contacts then downgrades       | At renewal: CO free, HU off entirely (no CO premium = no base) | E2         |
| Whitelabel config says cancel (not downgrade) | Full cancellation instead of downgrade to free                 | —          |
| Un-cancel before renewal                      | Flag cleared, normal renewal resumes                           | —          |
| Downgrade user_config update                  | **Not yet implemented (TODO-003, DISC-005)**                   | —          |

### How to Test

```bash
yarn dev:tools scenario downgrade-on-renewal
yarn dev:tools cron-run <user_id>
yarn dev:tools state <user_id>
# Verify: is_premium=0, HU access off, whitelabel config respected
```

---

## 16. Free Trial: `homeuptick_only` Lifecycle — `SHELVED`

> **WIP — Not included in initial release.** See [Section 3](#3-new-user-purchase-p-trial--homeuptick_only-hu-free-trial) for details.

**Scenario matrix refs:** P3, R3, R4, E1, X3, PZ3

**Process:** Billing-managed free trial. Card required upfront. CO = HOMEUPTICK. Auto-converts to paid HU at `trial_ends_at`.

### Full Lifecycle

| Phase                    | What Happens                                                                   | Verify                 |
| ------------------------ | ------------------------------------------------------------------------------ | ---------------------- |
| **Enrollment**           | Card required; subscription created; CO=HOMEUPTICK; HU=Trial-Active            | `trial_ends_at` set    |
| **During trial**         | No charges; trial warning email at 10 days before end                          | Email sent             |
| **Conversion (success)** | Charge card for HU usage; HU→Paid-Active; continues as P-HU                    | First charge processed |
| **Conversion (failure)** | Enter retry ladder; HU access revoked at `trial_ends_at`; on success, restored | Retry schedule applies |
| **Cancel during trial**  | `cancel_on_renewal` → no conversion; HU off; HOMEUPTICK → SHELL on cancel      | X3                     |
| **Pause during trial**   | Trial paused; `trial_ends_at` **extended** by pause duration on resume         | PZ3                    |

### Edge Cases

| Case                                             | Expected Behavior                                                                                  | Matrix Ref |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------- |
| When is HU access revoked on conversion failure? | At `trial_ends_at` (trial benefit ends). Retry continues for payment only. On success, HU restored | E1         |
| P-TRIAL user purchases P-CO before trial end     | End trial; upgrade to P-CO; CO premium + HU base                                                   | P4, E5     |
| CO deactivated during trial                      | Trial paused; `trial_ends_at` extended on resume                                                   | PZ3        |
| Multiple trial warnings                          | Only one warning per trial                                                                         | —          |

### How to Test

```bash
# Trial about to expire (triggers warning)
yarn dev:tools scenario trial-expiring
yarn dev:tools cron-preview
yarn dev:tools cron-run <user_id>

# Trial expired (triggers conversion)
yarn dev:tools scenario trial-expired
yarn dev:tools cron-run <user_id>
yarn dev:tools state <user_id>
# Verify: conversion charge, HU Paid-Active, HOMEUPTICK preserved

# Trial conversion failure
yarn dev:tools scenario trial-expired
yarn dev:tools break-card <user_id>
yarn dev:tools cron-run <user_id>
# Verify: HU access revoked at trial_ends_at, retry ladder started
```

**Integration test:**

```bash
yarn test api/tests/integration/free-trial.test.ts
```

---

## 17. Pause (CO Deactivation via Webhook) — `VERIFIED`

**Scenario matrix refs:** PZ1, PZ2, PZ3, F6, W1, W3

**Process:** CO account deactivated by admin → `user.deactivated` webhook → subscription **paused** regardless of `managed` flag. Paused ≠ Suspended.

### Behavior by Product and State

| Scenario                        | Result                                                                    | Matrix Ref |
| ------------------------------- | ------------------------------------------------------------------------- | ---------- |
| P-CO active                     | CO deactivated; HU frozen; no charges; no retries                         | PZ1        |
| P-HU active                     | HU frozen; CO external (now deactivated); no charges                      | PZ2        |
| P-TRIAL active                  | Trial paused; `trial_ends_at` extended on resume                          | PZ3        |
| **Any product in retry window** | **Pause stops retries.** Retry resumes from same position on reactivation | F6, W3     |

### Key Distinction: Paused vs Suspended

| Attribute            | Paused                                            | Suspended                                            |
| -------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Cause                | Admin/webhook deactivated CO                      | Max payment retries exhausted                        |
| Card update behavior | **Store card only; stay paused** (admin decision) | **Trigger immediate payment; reactivate on success** |
| Resume trigger       | `user.activated` webhook                          | Successful card update payment                       |
| Retry interaction    | Stops retries; resumes from same position         | N/A (already past retries)                           |

### How to Test

```bash
# Pause active subscription
yarn dev:tools scenario renewal-due
yarn dev:tools webhook user.deactivated <user_id>
yarn dev:tools state <user_id>
# Verify: status=paused, no charges, cron skips

# Pause during retry window
yarn dev:tools scenario payment-retry-1
yarn dev:tools webhook user.deactivated <user_id>
yarn dev:tools state <user_id>
# Verify: status=paused, retries stopped, payment_failure_count unchanged

# Pause P-TRIAL
yarn dev:tools scenario trial-expiring --product p-trial
yarn dev:tools webhook user.deactivated <user_id>
yarn dev:tools state <user_id>
# Verify: trial paused, trial_ends_at will be extended on resume
```

**Integration test:**

```bash
yarn test api/tests/integration/pause-resume.test.ts
yarn test api/tests/integration/webhook-cashoffers.test.ts
```

---

## 18. Resume (CO Reactivation via Webhook) — `VERIFIED`

**Scenario matrix refs:** PZ4, W4

**Process:** CO account reactivated → `user.activated` webhook → paused subscription resumed. Dates recalculated.

### Lifecycle

| Step                                                | What Happens                                     | Verify                         |
| --------------------------------------------------- | ------------------------------------------------ | ------------------------------ |
| 1. `user.activated` webhook                         | Signature verified                               | —                              |
| 2. Paused subs → active                             | Status changes                                   | `next_renewal_at` recalculated |
| 3. **`next_renewal_at` = today + remaining period** | Time remaining from before pause carried forward | Date correct                   |
| 4. P-TRIAL: **`trial_ends_at` extended**            | Extended by pause duration                       | Trial time preserved           |
| 5. If was in retry window                           | **Retries resume from same position**            | Same `payment_failure_count`   |

### Edge Cases

| Case                                           | Expected Behavior                                         | Matrix Ref |
| ---------------------------------------------- | --------------------------------------------------------- | ---------- |
| Long pause (months)                            | Renewal date extends by full paused duration              | PZ4        |
| Resume P-TRIAL                                 | `trial_ends_at` extended by pause duration                | PZ4        |
| Resume during retry                            | Retries resume from same `payment_failure_count` position | PZ4        |
| External CO team no longer exists after resume | Sub resumes; if CO deactivated again → another pause      | E8         |

### How to Test

```bash
# Full pause/resume cycle with simulated time gap
yarn dev:tools scenario renewal-due
yarn dev:tools webhook user.deactivated <user_id>
yarn dev:tools state <user_id>
# Verify: status=paused, suspension_date set

# Simulate time passing: backdate suspension_date and renewal_date by 2 months
# This makes it look like the user was paused 2 months ago with 14 days remaining
yarn dev:tools set-state <sub_id> suspension_date=2026-02-01T00:00:00Z renewal_date=2026-02-15T00:00:00Z
yarn dev:tools state <user_id>
# Verify: suspension_date and renewal_date are now in the past

# Resume — handler calculates: remaining days = renewal_date - suspension_date = 14 days
# New renewal_date = today + 14 days
yarn dev:tools webhook user.activated <user_id>
yarn dev:tools state <user_id>
# Verify: status=active, suspension_date=null, renewal_date ≈ today + 14 days

# Resume P-TRIAL (verify trial_ends_at extended)
yarn dev:tools scenario trial-expiring --product p-trial
yarn dev:tools webhook user.deactivated <user_id>
# Backdate to simulate a 1-month pause
yarn dev:tools set-state <sub_id> suspension_date=2026-03-01T00:00:00Z renewal_date=2026-03-10T00:00:00Z
yarn dev:tools webhook user.activated <user_id>
yarn dev:tools state <user_id>
# Verify: status=active, renewal_date ≈ today + 9 days (remaining from before pause)
```

---

## 19. Card Update — `VERIFIED`

**Scenario matrix refs:** C1-C5, F5, F7, F8, E6, E7

**Process:** User updates their payment card. Behavior depends on subscription state (active, in retry, suspended, paused).

### Behavior by Subscription State

| State                           | Card Update Behavior                                                                   | Matrix Ref |
| ------------------------------- | -------------------------------------------------------------------------------------- | ---------- |
| **Active**                      | New card stored, used at next renewal                                                  | C1         |
| **In retry window**             | New card stored, next retry uses it                                                    | C2, F5     |
| **Suspended** (max retries)     | **Trigger immediate payment.** On success → reactivate. On failure → remains suspended | C3, F7, E6 |
| **Paused** (admin deactivation) | **Store card only. Stay paused.** Paused = admin decision, not billing                 | C4, F8, E7 |
| **P-TRIAL enrollment**          | Required. Stored for auto-conversion at trial end                                      | C5         |

### Critical Distinction

> **Suspended + card update = immediate retry.** Paused + card update = no state change.

### Edge Cases

| Case                                        | Expected Behavior                          | Matrix Ref |
| ------------------------------------------- | ------------------------------------------ | ---------- |
| Card update on suspended sub, payment fails | Remains suspended, counts as another retry | E6         |
| Card update on paused sub                   | Store card only; stay paused               | E7         |
| Invalid card token                          | Error returned, old card kept              | —          |
| Card update via manage endpoint             | **Not implemented (TODO-001, DISC-001)**   | —          |

### How to Test

```bash
# Card update on active sub
yarn dev:tools state <user_id>      # Note current card
# Update card via frontend or API
yarn dev:tools state <user_id>      # Verify new card

# Card update triggers retry (in retry window)
yarn dev:tools scenario payment-retry-1
yarn dev:tools fix-card <user_id>   # Simulates card update
# Verify: next retry will use new card

# Card update on SUSPENDED sub → immediate payment
yarn dev:tools scenario payment-retry-3
yarn dev:tools break-card <user_id>
yarn dev:tools set-state <sub_id> next_renewal_attempt=2020-01-01T00:00:00Z
yarn dev:tools cron-run <user_id>   # 4th fail → suspend
yarn dev:tools fix-card <user_id>   # Card update → immediate payment attempt
yarn dev:tools state <user_id>      # Verify: reactivated if payment succeeded

# Card update on PAUSED sub → no state change
yarn dev:tools scenario renewal-due
yarn dev:tools webhook user.deactivated <user_id>  # Pause
yarn dev:tools fix-card <user_id>                   # Card update
yarn dev:tools state <user_id>                      # Verify: still paused
```

**Integration test:**

```bash
yarn test api/tests/integration/card-update-retry.test.ts
```

---

## 20. Plan Change (Upgrade) — `VERIFIED`

**Process:** Existing user upgrades to a higher-tier plan with prorated charge.

### Lifecycle

| Step                            | What Happens                                         | Verify                             |
| ------------------------------- | ---------------------------------------------------- | ---------------------------------- |
| 1. Navigate to Change Plan      | Dashboard → "Manage Subscription" → "Change Plan"    | Available products shown           |
| 2. Select new plan              | POST `/api/manage/checkplan` validates compatibility | Role compatibility checked         |
| 3. Prorated cost calculated     | `(newCost - oldCost) * remainingTimePercent`         | Never negative                     |
| 4. Confirm change               | POST `/api/manage/purchase`                          | Prorated charge + new sub          |
| 5. Old subscription deactivated | Previous sub marked inactive                         | Only one active sub                |
| 6. New subscription created     | New amount, duration, product_id                     | `next_renewal_at` set              |
| 7. User config updated          | Role mapping rules applied                           | AGENT → TEAMOWNER if single → team |

### Edge Cases

| Case                        | Expected Behavior                |
| --------------------------- | -------------------------------- |
| Upgrade on day 1 of cycle   | Full prorated difference charged |
| Same plan → same plan       | Rejected or no-op                |
| AGENT ↔ INVESTOR            | Role incompatibility — blocked   |
| Upgrade during retry window | Clears retry state               |
| Prorated cost = $0          | No charge, just switch           |

### How to Test

**Frontend:**

1. Navigate to `http://localhost:3000/manage`
2. Log in → "Manage Subscription" → "Change Plan"
3. Select higher-tier plan
4. Verify prorated cost, confirm
5. `yarn dev:tools state <user_id>` — verify new subscription

---

## 21. Plan Change (Downgrade) — `VERIFIED`

**Process:** User switches to a lower-tier plan. Takes effect immediately.

### Lifecycle

| Step                            | What Happens                     | Verify                      |
| ------------------------------- | -------------------------------- | --------------------------- |
| 1. Select lower plan            | Via manage flow                  | Plan change initiated       |
| 2. New plan applied immediately | Subscription updated to new plan | Access level changed        |
| 3. Role mapping applied         | Team → single: TEAMOWNER → AGENT | Correct role                |
| 4. Prorated billing adjusted    | Remaining period recalculated    | Next renewal amount updated |

### Edge Cases

| Case                         | Expected Behavior                  |
| ---------------------------- | ---------------------------------- |
| Team → single                | TEAMOWNER → AGENT role change      |
| Downgrade user_config update | **Not yet implemented (TODO-003)** |

---

## 22. Payment Refund — `VERIFIED`

**Process:** Admin refunds a completed payment.

### Lifecycle

| Step                          | What Happens                                  | Verify          |
| ----------------------------- | --------------------------------------------- | --------------- |
| 1. POST `/api/payment/refund` | Transaction must exist, not already refunded  | Validated       |
| 2. Square refund processed    | Same environment as original charge           | Square confirms |
| 3. Transaction updated        | Original marked `refunded`, new refund record | Two records     |
| 4. Email sent                 | Refund confirmation                           | Email           |

### Edge Cases

| Case                    | Expected Behavior         |
| ----------------------- | ------------------------- |
| Already refunded        | Error — blocked           |
| Non-payment transaction | Error — wrong type        |
| Partial refund          | Not supported (full only) |

### How to Test

```bash
# Refund most recent payment for a user
yarn dev:tools refund <user_id>

# Refund a specific transaction
yarn dev:tools refund <user_id> --transaction-id <square_transaction_id>

# Verify refund was recorded
yarn dev:tools state <user_id>
# Check transactions for refund record + original marked as "refunded"
```

---

## 23. Property Unlock — `VERIFIED`

**Process:** One-time $50 charge to unlock a property.

### Lifecycle

| Step                                    | What Happens                | Verify             |
| --------------------------------------- | --------------------------- | ------------------ |
| 1. POST `/api/property/:property_token` | Token validated             | —                  |
| 2. Property fetched                     | External API lookup         | Property exists    |
| 3. Card charged                         | $50 via Square              | Transaction logged |
| 4. Property updated                     | External API marks unlocked | Status changed     |
| 5. Confirmation email                   | PropertyUnlocked event      | Email sent         |

### Edge Cases

| Case                                       | Expected Behavior      |
| ------------------------------------------ | ---------------------- |
| Payment succeeds but property update fails | **Auto-refund issued** |
| Invalid token                              | Error before charge    |
| No card on file                            | Error                  |

### How to Test

```bash
# Create a test user with a sandbox card
yarn dev:tools scenario renewal-due

# Charge $50 for a property unlock (any token works for dev testing)
yarn dev:tools property-unlock <property_token> --user <user_id>

# Verify transaction was logged
yarn dev:tools state <user_id>

# Test refunding the property unlock charge
yarn dev:tools refund <user_id>
```

---

---

## 26. Cron: Trial Warning & Expiration — `SHELVED`

**Process:** Cron handles trial warning emails and trial conversion/expiration.

### Trial Warning (10 days before)

| Step               | What Happens                   | Verify               |
| ------------------ | ------------------------------ | -------------------- |
| 1. Query trials    | `trial_ends_at` within 10 days | Correct trials found |
| 2. Warning email   | "Your trial expires in X days" | Email sent           |
| 3. No state change | Trial continues                | Status unchanged     |

### Trial Expiration

See [P-TRIAL Conversion](#10-subscription-renewal-p-trial-conversion).

### How to Test

```bash
yarn dev:tools scenario trial-expiring
yarn dev:tools cron-preview
yarn dev:tools cron-run <user_id>
```

---

## 26b. Manage Billing: Premium User Without Subscription — `VERIFIED`

**Process:** Premium user with no billing subscription visits the manage billing section. Two distinct scenarios exist:

### Scenario A: Adding Card for HomeUptick (Default)

**When:** User has `is_premium=1` (CO managed externally) and navigates to `/manage`.

| Step                               | What Happens                                                | Verify                                 |
| ---------------------------------- | ----------------------------------------------------------- | -------------------------------------- |
| 1. User logs in to `/manage`       | Auth cookie set                                             | Dashboard loads                        |
| 2. `GET /manage/enrollment`        | Returns `external_cashoffers` products                      | `product_category=external_cashoffers` |
| 3. Products filtered by whitelabel | Correct `external_cashoffers` product for user's whitelabel | Whitelabel match                       |
| 4. User completes enrollment       | `POST /api/purchase/existing`                               | HU-only subscription created           |
| 5. HomeUptick subscription seeded  | `Homeuptick_Subscriptions` row created                      | HU config set                          |

### Scenario B: Admin-Directed Premium Subscription

**When:** Admin creates a user manually, then sends the user a custom link to subscribe to a real `premium_cashoffers` product. The link includes `?category=premium_cashoffers` to override the default.

| Step                                                    | What Happens                                               | Verify                            |
| ------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------- |
| 1. Admin generates auth link                            | `yarn dev:tools auth-link <user_id>`                       | URL generated                     |
| 2. Admin sends custom URL                               | `{manage_url}?goto=enrollment&category=premium_cashoffers` | User receives link                |
| 3. User follows link                                    | Auth cookie set, redirected to enrollment                  | Dashboard loads                   |
| 4. `GET /manage/enrollment?category=premium_cashoffers` | Returns `premium_cashoffers` products                      | Category override applied         |
| 5. User selects plan and pays                           | `POST /api/purchase/existing`                              | Full premium subscription created |
| 6. User config applied                                  | `is_premium=1`, correct role, HU seeded                    | User now has full CO + HU         |

### How to Test

```bash
# Scenario A: External user auto-enrollment
yarn dev:tools auth-link <premium_user_id>
# Open the manage URL → enrollment shows external_cashoffers products

# Scenario B: Admin-directed premium enrollment
yarn dev:tools auth-link <admin_created_user_id>
# Append ?goto=enrollment&category=premium_cashoffers to the manage URL
# Open the URL → enrollment shows premium_cashoffers products
```

---

## Known Gaps & TODOs

| ID                  | Gap                                              | Impact                                        | Status                     |
| ------------------- | ------------------------------------------------ | --------------------------------------------- | -------------------------- |
| TODO-001 / DISC-001 | Square card update via manage endpoint           | Users can't update card via manage route stub | Stub returns error         |
| TODO-002 / DISC-003 | Suspension cron (auto-suspend after max retries) | 4th failure doesn't auto-suspend              | Manual suspension required |
| TODO-003 / DISC-005 | Upgrade/downgrade user_config update             | Plan change doesn't update role/premium       | Config stale after switch  |
| TODO-004 / DISC-002 | HomeUptick tier-based renewal verification       | Tier pricing may not calculate correctly      | Needs code review          |
| DISC-004            | Square webhook handler status                    | Unclear if Square webhooks are processed      | Verify configuration       |
| DISC-006            | Suspension user_config revert                    | Suspended users keep premium config           | Config not cleaned up      |
| DISC-008            | Permission strings not documented locally        | Auth rules reference main API permissions     | No local reference         |

---

## Testing Checklist Summary

Use this as a go/no-go checklist. Mark each item as you verify it. Items marked with scenario matrix references (e.g., `[P1]`) trace directly to the [Billing Scenario Matrix](../business/capabilities/billing-scenario-matrix.md).

### Purchase / Enrollment

- [ ] `premium_cashoffers` purchase — new user (CO premium + HU base 500, HomeUptick seeded) `[P1]`
- [ ] `premium_cashoffers` purchase — existing user had HU auto-trial (auto-trial cleared) `[P5]`
- [ ] `premium_cashoffers` purchase — existing user had `homeuptick_only` trial (trial ended, upgraded) `[P4]`
- [ ] `external_cashoffers` enrollment — via manage flow (managed=false, CO untouched) `[P2]`
- [ ] `external_cashoffers` enrollment — KW/team member `[P7]`
- [ ] `homeuptick_only` purchase (no trial) — new user, card charged, CO=HOMEUPTICK, HU=Paid-Active `[P3]`
- [ ] `homeuptick_only` purchase (no trial) — user had auto-trial (auto-trial cleared) `[P6]`
- [ ] `homeuptick_only` enrollment (free trial, WIP) — card required, CO=HOMEUPTICK, HU=Trial-Active `[P3]`
- [ ] `homeuptick_only` enrollment (free trial, WIP) — user had auto-trial (auto-trial cleared) `[P6]`
- [ ] Free signup (no card, amount=0)
- [ ] Investor signup (additional consent, role=INVESTOR)
- [ ] Team plan signup (TEAMOWNER role, team name step)
- [ ] Whitelabel signup (at least 2 whitelabels)
- [ ] Duplicate email handling
- [ ] Card decline on signup
- [ ] Mock purchase mode

### Subscription Renewal

- [ ] `premium_cashoffers` renewal — combined CO base + HU usage charge `[R1]`
- [ ] `premium_cashoffers` renewal — user ≤500 contacts (HU usage = $0, base included)
- [ ] `premium_cashoffers` renewal — user >500 contacts (HU usage-based tier charged)
- [ ] `external_cashoffers` renewal — HU-only usage-based charge `[R2]`
- [ ] `homeuptick_only` renewal (no trial) — HU usage-based charge, CO=HOMEUPTICK unchanged `[R2]`
- [ ] `homeuptick_only` conversion (free trial, WIP) — auto-convert at trial_ends_at `[R3]`
- [ ] `homeuptick_only` conversion failure — (WIP) enters retry ladder `[R4]`
- [ ] HU tier changed since last renewal — new tier auto-applied `[P8]`
- [ ] HU API unavailable at renewal — **do not charge CO, retry without penalty** `[R5]`
- [ ] Renewal email shows CO base + HU usage breakdown `[E11]`

### Payment Failure & Retry

- [ ] User-fault failure → increment payment_failure_count `[F1]`
- [ ] Retry at 1 day (payment_failure_count=1)
- [ ] Retry at 3 days (payment_failure_count=2)
- [ ] Retry at 7 days (payment_failure_count=3)
- [ ] 4th failure → auto-suspend `[F1]`
- [ ] System-fault failure → **do NOT increment** payment_failure_count `[F2]`
- [ ] System-fault → retry at same interval (not escalated) `[F2]`
- [ ] HU API down → do not charge CO, retry without penalty `[R5]`
- [ ] Card update during retry window → next retry uses new card `[F5]`
- [ ] CO deactivation during retry → **pause stops retries** `[F6]`

### Suspension

- [ ] `premium_cashoffers` suspended — whitelabel DEACTIVATE_USER → role=SHELL `[F3]`
- [ ] `premium_cashoffers` suspended — whitelabel DOWNGRADE_TO_FREE → is_premium=0, role unchanged `[F3]`
- [ ] `external_cashoffers` suspended — HU off, CO untouched `[F4]`
- [ ] SHELL preserved in all suspension scenarios
- [ ] Card update on suspended sub → immediate payment → reactivate `[F7, E6]`
- [ ] Card update on suspended, payment fails → remains suspended `[E6]`

### Cancel / Downgrade

- [ ] cancel_on_renewal `premium_cashoffers` — CO per whitelabel, HU off, SHELL preserved `[X1]`
- [ ] cancel_on_renewal `external_cashoffers` — HU off, CO untouched `[X2]`
- [ ] cancel_on_renewal `homeuptick_only` — (WIP) no conversion, HU off, HOMEUPTICK → SHELL `[X3]`
- [ ] Immediate cancellation (admin) `[X4]`
- [ ] Uncancel before renewal
- [ ] Downgrade `premium_cashoffers` → free (is_premium=0, HU base removed, HU off) `[D1]`
- [ ] `premium_cashoffers` user >500 contacts then downgrade → HU off entirely `[E2]`

### Free Trials (WIP — not in initial release)

- [ ] `homeuptick_only` enrollment (card required, CO=HOMEUPTICK) `[P3]`
- [ ] `homeuptick_only` warning email (10 days before)
- [ ] `homeuptick_only` → paid conversion (success, charge card) `[R3]`
- [ ] `homeuptick_only` → conversion failure (retry ladder, HU revoked at trial_ends_at) `[R4, E1]`
- [ ] `homeuptick_only` cancel during trial (no conversion, HU off) `[X3]`
- [ ] `homeuptick_only` paused (trial_ends_at extended on resume) `[PZ3]`
- [ ] `homeuptick_only` user purchases `premium_cashoffers` before trial end `[P4, E5]`
- [ ] HU auto-trial — billing pauses on CO deactivation `[W2]`
- [ ] HU auto-trial — billing resumes on CO reactivation `[W5]`
- [ ] HU auto-trial cleared on `premium_cashoffers` purchase `[P5]`
- [ ] HU auto-trial cleared on `homeuptick_only` enrollment `[P6]`

### Pause / Resume

- [ ] Pause `premium_cashoffers` (CO deactivated, HU frozen, no charges) `[PZ1]`
- [ ] Pause `external_cashoffers` (HU frozen, CO external) `[PZ2]`
- [ ] Pause `homeuptick_only` (WIP) (trial paused, trial_ends_at extended on resume) `[PZ3]`
- [ ] Pause during retry window → retries stop `[F6]`
- [ ] Resume any → next_renewal_at recalculated (today + remaining) `[PZ4]`
- [ ] Resume `homeuptick_only` (WIP) → trial_ends_at extended by pause duration `[PZ4]`
- [ ] Resume from retry → retries resume from same position `[PZ4]`
- [ ] Long pause → renewal date extends by full paused duration

### Card Management

- [ ] Card replaced on active sub → used at next renewal `[C1]`
- [ ] Card replaced during retry → next retry uses new card `[C2]`
- [ ] Card replaced on **suspended** sub → immediate payment → reactivate `[C3]`
- [ ] Card replaced on **paused** sub → store card only, stay paused `[C4]`
- [ ] Card at `homeuptick_only` enrollment (WIP) → stored for conversion `[C5]`

### Webhooks

- [ ] user.deactivated — active subscription → paused `[W1]`
- [ ] user.deactivated — `homeuptick_only` trial (WIP) → trial paused `[W1]`
- [ ] user.deactivated — in retry window → pause stops retries `[W3]`
- [ ] user.deactivated — HU auto-trial → pause auto-trial `[W2]`
- [ ] user.deactivated — no subscription → log and ignore `[W6]`
- [ ] user.activated — paused subscription → resumed `[W4]`
- [ ] user.activated — paused auto-trial → resumed `[W5]`
- [ ] user.created → free trial created
- [ ] Invalid webhook signature → 401 rejected

### Edge Cases

- [ ] `homeuptick_only` conversion fails (WIP) — HU revoked at trial_ends_at, retry continues `[E1]`
- [ ] `premium_cashoffers` user >500 contacts, downgrades → no HU access at all `[E2]`
- [ ] `external_cashoffers` user external CO team ends → webhook pause → resume cycle `[E3]`
- [ ] Auto-trial AND `homeuptick_only` → auto-trial cleared `[E4]`
- [ ] `homeuptick_only` user purchases `premium_cashoffers` → trial ended, CO premium `[E5]`
- [ ] Suspended user card update → immediate payment attempt `[E6]`
- [ ] Paused user card update → card stored, stay paused `[E7]`
- [ ] `external_cashoffers`: CO deactivated, paused, reactivated, team gone → another pause `[E8]`
- [ ] HU API down extended → retries without failure_count increment `[E9]`
- [ ] user.deactivated for unknown user → log and ignore `[E10]`
- [ ] Renewal email shows correct HU info per user type `[E11]`

### Emails

- [ ] All email templates render (preview:emails)
- [ ] `premium_cashoffers` renewal email: CO base + HU usage breakdown `[E11]`
- [ ] `homeuptick_only` conversion email (WIP): first charge shown
- [ ] Suspension email: card update instructions
- [ ] DEV_EMAIL redirect works
- [ ] SEND_EMAILS=false doesn't block operations

### Manage Billing Enrollment

- [ ] Premium user (no sub) → enrollment shows `external_cashoffers` products
- [ ] Non-premium user (no sub) → enrollment shows `homeuptick_only` products
- [ ] `?category=premium_cashoffers` override → shows `premium_cashoffers` products
- [ ] User with active sub → enrollment returns 409
- [ ] Invalid whitelabel on signup → 404 (no products)
- [ ] `external_cashoffers` products NOT shown on main signup page
- [ ] `yarn dev:tools verify` passes with no errors
- [ ] `yarn dev:tools auth-link <user_id>` generates valid manage URL

### Auth & Security

- [ ] Unauthenticated requests → 401
- [ ] Non-admin cross-user access → 403
- [ ] Self-access allowed
- [ ] Cron secret required
- [ ] Webhook HMAC signature verified
- [ ] Dev routes hidden in production

### Sandbox/Test Mode

- [ ] Mock purchase mode works
- [ ] Sandbox Square charges work
- [ ] Test email routing to sandbox
