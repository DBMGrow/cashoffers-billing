# QA Test Plan — Go-Live Migration

Complete walkthrough of every system process, its lifecycle, edge cases, and how to test each step. Designed so a developer can work through every item sequentially and have full confidence that every case is accounted for.

> **Definitive reference:** [Billing Scenario Matrix](../business/capabilities/billing-scenario-matrix.md) — all product types, state combinations, lifecycle events, and edge cases.

## Prerequisites

```bash
# Dev server running
yarn dev

# Dev tools CLI available
yarn dev:tools

# Verify system is healthy
yarn dev:tools system
```

---

## Table of Contents

1. [New User Purchase: P-CO (CO Premium)](#1-new-user-purchase-p-co-co-premium)
2. [New User Purchase: P-HU (HU Standalone)](#2-new-user-purchase-p-hu-hu-standalone)
3. [New User Purchase: P-TRIAL (HU Free Trial)](#3-new-user-purchase-p-trial-hu-free-trial)
4. [New User Signup (Free)](#4-new-user-signup-free)
5. [New User Signup (Investor)](#5-new-user-signup-investor)
6. [New User Signup (Team Plan)](#6-new-user-signup-team-plan)
7. [Whitelabel Signup](#7-whitelabel-signup)
8. [Subscription Renewal: P-CO (Combined CO+HU)](#8-subscription-renewal-p-co-combined-cohu)
9. [Subscription Renewal: P-HU](#9-subscription-renewal-p-hu)
10. [Subscription Renewal: P-TRIAL Conversion](#10-subscription-renewal-p-trial-conversion)
11. [Payment Failure — User-Fault (Card Declined)](#11-payment-failure--user-fault-card-declined)
12. [Payment Failure — System-Fault (HU API / Square Down)](#12-payment-failure--system-fault-hu-api--square-down)
13. [Suspension After Max Retries](#13-suspension-after-max-retries)
14. [Cancel on Renewal](#14-cancel-on-renewal)
15. [Downgrade on Renewal (P-CO → Free)](#15-downgrade-on-renewal-p-co--free)
16. [Free Trial: P-TRIAL Lifecycle](#16-free-trial-p-trial-lifecycle)
17. [Free Trial: HU Auto-Trial (Non-Billing)](#17-free-trial-hu-auto-trial-non-billing)
18. [Pause (CO Deactivation via Webhook)](#18-pause-co-deactivation-via-webhook)
19. [Resume (CO Reactivation via Webhook)](#19-resume-co-reactivation-via-webhook)
20. [Card Update](#20-card-update)
21. [Plan Change (Upgrade)](#21-plan-change-upgrade)
22. [Plan Change (Downgrade)](#22-plan-change-downgrade)
23. [Payment Refund](#23-payment-refund)
24. [Property Unlock](#24-property-unlock)
25. [Webhook: User Deactivated](#25-webhook-user-deactivated)
26. [Webhook: User Activated](#26-webhook-user-activated)
27. [Webhook: User Created](#27-webhook-user-created)
28. [Cron: Trial Warning & Expiration](#28-cron-trial-warning--expiration)
29. [Manage Account: Login & View](#29-manage-account-login--view)
30. [Email Notifications](#30-email-notifications)
31. [Authorization & Permissions](#31-authorization--permissions)
32. [Sandbox / Test Mode](#32-sandbox--test-mode)

---

## Key Concepts

Before testing, understand these distinctions from the [Billing Scenario Matrix](../business/capabilities/billing-scenario-matrix.md):

| Concept | Definition |
|---|---|
| **Product types** | P-CO (CO Premium, managed=true), P-HU (HU standalone, managed=false), P-TRIAL (HU free trial + SHELL, card required) |
| **`managed` flag** | `true` = billing controls CO access. `false` = CO is external, billing only manages HU |
| **SHELL role** | Zero-feature CO access. Exists solely so HU login works (HU auth depends entirely on CO). Preserved on subscription end/suspension |
| **Paused vs Suspended** | **Paused** = admin/webhook deactivated CO account. **Suspended** = max payment retries exhausted. Different card-update behaviors |
| **Combined charging** | CO and HU always charged together. If HU API is down at renewal, do NOT charge CO — retry the whole thing |
| **Non-user-fault failures** | HU API down, Square outage → do NOT increment `payment_failure_count`. Retry without penalty |
| **Auto-trial vs P-TRIAL** | Auto-trial = HU-driven, no billing, no card. P-TRIAL = billing-managed, card required, auto-converts to paid |
| **Whitelabel suspension** | `DEACTIVATE_USER` → role=SHELL. `DOWNGRADE_TO_FREE` → is_premium=0, role unchanged. SHELL always preserved |

---

## 1. New User Purchase: P-CO (CO Premium)

**Scenario matrix refs:** P1, P4, P5

**Process:** New user purchases CO Premium subscription. CO access = premium. HU base 500 contacts included (no separate charge). HU usage-based tiers auto-applied if >500 contacts.

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. Land on pricing page | Products load filtered by whitelabel | Products display with correct prices |
| 2. Click "Sign Up" on a product | Navigates to subscribe flow | URL is `/{whitelabel}/subscribe/{product}` |
| 3. Enter email | System checks if user exists | New user proceeds; existing user gets reactivation offer |
| 4. Enter name, slug, phone | Standard validation | Fields captured |
| 5. Enter card details | Square tokenizes card in browser | Card nonce generated (no PCI data hits server) |
| 6. Review & accept terms | All consents displayed | TOS, general, communication checkboxes required |
| 7. Submit | Backend processes purchase | See backend steps below |
| 8. Welcome screen | Success confirmation | User directed to set password |

**Backend steps on submit (POST `/api/purchase/new`):**

| Step | What Happens | Verify |
|---|---|---|
| A | Validate product exists, active, `managed=true` | Invalid product → 400 |
| B | Create card in Square with null user_id | Card created in Square |
| C | Charge signup fee via Square | Transaction logged, amount matches product `signup_fee` |
| D | Create user in main API with `user_config` | User: correct role, `is_premium=1`, whitelabel |
| E | Bind card to new user | UserCards links user_id to card_id |
| F | Create subscription record | Status: `active`, `next_renewal_at` = now + duration |
| G | **Clear existing HU auto-trial** if present | Auto-trial removed (CO premium supersedes) |
| H | **Clear existing P-TRIAL** if present | Trial ended, upgraded to P-CO |
| I | Emit SubscriptionCreated event | Premium activation fires |
| J | Send confirmation email | Email received |

### Edge Cases

| Case | Expected Behavior | Matrix Ref |
|---|---|---|
| User had HU auto-trial | Clear auto-trial; CO premium HU access supersedes | P5 |
| User had active P-TRIAL | End trial early; upgrade to P-CO; charge CO amount | P4 |
| Card declined | Error shown, user can retry | — |
| Payment succeeds but user creation fails | No refund; admin alerted; customer emailed | — |
| Duplicate email | "Account exists" with reactivation offer | — |

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
```

---

## 2. New User Purchase: P-HU (HU Standalone)

**Scenario matrix refs:** P2, P7

**Process:** User whose CO is managed externally (KW agents, team members) purchases HU standalone. `managed=false` — billing never touches CO account.

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. User selects P-HU product | Product has `managed=false` | Billing won't control CO |
| 2. Card entry + submit | Standard payment flow | Card nonce generated |
| 3. Charge via Square | HU-only charge | No CO charge component |
| 4. Subscription created | `managed=false`, HU data = Paid-Active | CO untouched |
| 5. HU access activated | Usage-based billing starts | HU tier based on contacts |

### Edge Cases

| Case | Expected Behavior | Matrix Ref |
|---|---|---|
| KW/team member purchases | `managed=false`; CO external | P7 |
| User already has P-CO | Should not be allowed (already has HU via CO premium) | — |
| CO deactivated later | Webhook pauses P-HU; HU access frozen | PZ2 |

### How to Test

**Dev CLI:**

```bash
yarn dev:tools scenario renewal-due --product p-hu --email test-phu@dev-test.local
yarn dev:tools state <user_id>
# Verify: managed=false, CO untouched, HU paid-active
```

---

## 3. New User Purchase: P-TRIAL (HU Free Trial)

**Scenario matrix refs:** P3, P6

**Process:** User enrolls in billing-managed HU free trial. Card required upfront. Auto-converts to paid HU at `trial_ends_at`. CO access = SHELL (zero features, allows HU login).

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. User selects P-TRIAL | Product requires card | Card form displayed |
| 2. Card entry | Square tokenizes | Card stored for auto-conversion |
| 3. Submit | No charge during trial | Transaction amount = 0 or no transaction |
| 4. Subscription created | Status: `free_trial`, `trial_ends_at` set | CO = SHELL, HU = Trial-Active |
| 5. **Clear HU auto-trial** if present | P-TRIAL replaces auto-trial | Auto-trial removed |

### Edge Cases

| Case | Expected Behavior | Matrix Ref |
|---|---|---|
| User had HU auto-trial | Clear auto-trial; P-TRIAL takes over | P6 |
| User purchases P-CO during trial | End trial early; upgrade to P-CO | P4 |
| CO deactivated during trial | Trial paused; `trial_ends_at` extended on resume | PZ3 |
| Cancel during trial | `cancel_on_renewal` → no conversion at trial end | X3 |

### How to Test

**Dev CLI:**

```bash
yarn dev:tools scenario trial-expired --product p-trial --email test-ptrial@dev-test.local
yarn dev:tools state <user_id>
# Verify: status=free_trial, CO=SHELL, HU=Trial-Active, trial_ends_at set, card on file
```

---

## 4. New User Signup (Free)

**Process:** New user creates a free account (no payment required).

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. Select free product | Card step skipped | No Square form |
| 2. Complete form | Standard validation | Fields captured |
| 3. Submit | POST `/api/purchase/new` (no card) | No payment |
| 4. User created | `user_config` from free product applied | Role per product, `is_premium` per product |
| 5. Subscription created | Status: `active`, amount: 0 | No renewal charges |

### How to Test

**Frontend:**

1. Navigate to `http://localhost:3000/{whitelabel}/subscribe/{free_product_id}`
2. Complete form — card step skipped
3. Verify subscription amount=0: `yarn dev:tools state <user_id>`

---

## 5. New User Signup (Investor)

Same as [P-CO purchase](#1-new-user-purchase-p-co-co-premium) with:

| Difference | Detail |
|---|---|
| Entry point | `/investor` or product with investor role |
| Additional consent | Investor-specific checkbox on review step |
| Role | `user_config.role` = `INVESTOR` |
| Slug step | Skipped (investors don't get lead capture pages) |

### Edge Cases

| Case | Expected Behavior |
|---|---|
| Investor tries to switch to AGENT plan | Role incompatibility — blocked by `checkplan` |
| AGENT tries to switch to investor plan | Role incompatibility — blocked |

---

## 6. New User Signup (Team Plan)

Same as [P-CO purchase](#1-new-user-purchase-p-co-co-premium) with:

| Difference | Detail |
|---|---|
| Product | `is_team_plan: true` |
| Role | `user_config.role` = `TEAMOWNER` |
| Team step | Additional "Team Name" step |
| Broker step | May appear depending on whitelabel |

### Edge Cases

| Case | Expected Behavior |
|---|---|
| Team plan → single plan downgrade | Role changes to AGENT (role mapping) |
| Single plan → team plan upgrade | Role changes to TEAMOWNER |

---

## 7. Whitelabel Signup

**Process:** Partner-branded signup flow with whitelabel-specific products and branding.

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. Navigate to `/{whitelabel_code}` | Whitelabel branding loads | Correct logo, colors, partner name |
| 2. Products filtered | Only products for this whitelabel shown | Products match whitelabel config |
| 3. Signup flow | Standard flow with branding | `white_label_id` set on user |
| 4. Emails | Whitelabel templates used (if configured) | Partner branding in email |

### Edge Cases

| Case | Expected Behavior |
|---|---|
| Invalid whitelabel code | 404 or fallback to default |
| Whitelabel with no products | Empty pricing page |
| Missing email template | Falls back to default template |

**Known whitelabel codes:** `kwofferings`, `yhs`, `uco`, `mop`, `eco`, `platinum`

---

## 8. Subscription Renewal: P-CO (Combined CO+HU)

**Scenario matrix refs:** R1, R5, R6

**Process:** Cron finds P-CO subscription due for renewal. Charges **combined** CO base + HU usage in a single payment. HU contact count fetched from HU API at charge time.

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. Cron triggered | POST `/api/cron/subscriptions` with CRON_SECRET | Endpoint responds 200 |
| 2. Query due subscriptions | `next_renewal_at <= now` AND status = `active` | Correct subscriptions found |
| 3. Check user active in main API | Fetches user | Active proceed, inactive skipped |
| 4. Check cancel/downgrade flags | Neither flag set | Proceeds to charge |
| 5. **Fetch HU contact count from HU API** | GET client count from HomeUptick | Count returned |
| 6. **Calculate combined charge** | CO base + HU usage-based tier | Amount = CO base + HU tier cost |
| 7. Charge via Square | Single combined payment | Transaction logged as "renewal" |
| 8. Update next_renewal_at | now + duration | Date advanced |
| 9. Reset payment_failure_count | Set to 0 | Clean slate |
| 10. Send renewal email | Receipt shows CO base + HU usage breakdown | Email with line items |

### Edge Cases

| Case | Expected Behavior | Matrix Ref |
|---|---|---|
| **HU API unavailable** | **Do NOT charge CO.** Do not increment `payment_failure_count`. Schedule retry without penalty | R5 |
| User has ≤500 contacts | HU usage = $0 (base included with CO premium) | R1 |
| User has >500 contacts | HU usage charge based on tier | P8 |
| User inactive in main API | Subscription skipped (no charge) | — |
| HU contact count changed since last renewal | New tier automatically applied | P8 |

### How to Test

**Dev CLI:**

```bash
# Create P-CO subscription due for renewal
yarn dev:tools scenario renewal-due
yarn dev:tools cron-preview
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

## 9. Subscription Renewal: P-HU

**Scenario matrix ref:** R2

**Process:** P-HU subscription renews. HU-only charge based on contact count. CO untouched.

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. Fetch HU contact count | From HU API | Count returned |
| 2. Calculate charge | Usage-based HU tier pricing | Correct tier amount |
| 3. Charge via Square | HU-only payment | Single transaction |
| 4. Update next_renewal_at | now + duration | Date advanced |
| 5. CO untouched | `managed=false` | No CO state changes |

### Edge Cases

| Case | Expected Behavior | Matrix Ref |
|---|---|---|
| HU API unavailable | Do not charge. Retry without incrementing failure count | R5 |
| Tier changed since last renewal | New tier cost applied | P8 |

### How to Test

```bash
yarn dev:tools scenario renewal-due --product p-hu
yarn dev:tools cron-run <user_id>
yarn dev:tools state <user_id>
```

**Integration test:**

```bash
yarn test api/tests/integration/homeuptick-module.test.ts
```

---

## 10. Subscription Renewal: P-TRIAL Conversion

**Scenario matrix refs:** R3, R4

**Process:** P-TRIAL reaches `trial_ends_at`. System auto-converts: charges card for HU usage-based amount. HU data transitions Trial-Active → Paid-Active. Subscription continues as P-HU equivalent.

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. Cron detects `trial_ends_at <= now` | P-TRIAL identified for conversion | Correct trial found |
| 2. Charge card | HU usage-based amount | First real charge |
| 3. HU data → Paid-Active | Trial-Active → Paid-Active | HU data state changed |
| 4. Subscription continues | As P-HU equivalent with billing | `next_renewal_at` set |
| 5. CO stays SHELL | No change to CO access | SHELL preserved |

### Edge Cases

| Case | Expected Behavior | Matrix Ref |
|---|---|---|
| Conversion payment fails | Enter retry ladder (**user-fault only**). HU access revoked at `trial_ends_at`. On success, HU restored. On max retries, suspend | R4, E1 |
| `cancel_on_renewal` set during trial | Do not convert. HU access off at trial end. SHELL preserved | X3 |
| User purchased P-CO before trial end | Trial already ended/upgraded — conversion skipped | P4 |

### How to Test

**Dev CLI:**

```bash
yarn dev:tools scenario trial-expired
yarn dev:tools cron-preview
yarn dev:tools cron-run <user_id>
yarn dev:tools state <user_id>
# Verify: status transition, first charge, HU Paid-Active
```

**Integration test:**

```bash
yarn test api/tests/integration/free-trial.test.ts
```

---

## 11. Payment Failure — User-Fault (Card Declined)

**Scenario matrix refs:** F1, F5, F6

**Process:** Renewal payment fails due to user-fault (card declined, insufficient funds, expired card). System increments `payment_failure_count` and schedules retry.

### Retry Schedule

| `payment_failure_count` | Wait Before Retry | Next Action |
|---|---|---|
| 1 | +1 day | Retry |
| 2 | +3 days | Retry |
| 3 | +7 days | Retry |
| 4 | **Suspend** | See [Suspension](#13-suspension-after-max-retries) |

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. Renewal attempted | Square charge fails (user-fault) | PaymentFailed event emitted |
| 2. **Increment `payment_failure_count`** | Count goes up by 1 | Counter updated in DB |
| 3. Failure logged | Transaction record with failure status | Transaction visible |
| 4. Failure email sent | User notified of failed payment | Email sent |
| 5. Retry scheduled | `next_renewal_at` set per retry schedule | Date set correctly |
| 6. Next cron run | Picks up subscription when retry window opens | Retry attempted |

### Edge Cases

| Case | Expected Behavior | Matrix Ref |
|---|---|---|
| Card updated during retry window | Next retry uses new card | F5 |
| CO deactivated during retry window | **Pause stops retries.** Retry resumes from same position on reactivation | F6 |
| User cancels during retry | `cancel_on_renewal` respected | — |

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

## 12. Payment Failure — System-Fault (HU API / Square Down)

**Scenario matrix refs:** F2, R5, R6

**Process:** Renewal fails due to non-user-fault (HU API unavailable, Square outage). System does **NOT** increment `payment_failure_count`. Retries at the same interval position.

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. Renewal attempted | Fails due to system issue | Error logged |
| 2. **Do NOT increment `payment_failure_count`** | Counter stays the same | DB unchanged |
| 3. Schedule retry | Same interval position (not escalated) | Retry without penalty |
| 4. No user-facing failure email | System issue, not user's fault | No email (or admin alert only) |

### Key Distinction

| Failure Type | `payment_failure_count` | Retry Interval | Email |
|---|---|---|---|
| Card declined (user-fault) | Incremented | Escalating (1d→3d→7d) | User notified |
| HU API down (system-fault) | **Not incremented** | Same position | Admin alert only |
| Square outage (system-fault) | **Not incremented** | Same position | Admin alert only |

### Edge Cases

| Case | Expected Behavior | Matrix Ref |
|---|---|---|
| HU API down for P-CO renewal | Do not charge CO either. Retry whole thing | R5 |
| HU API down for P-HU renewal | Do not charge. Retry without penalty | R5 |
| Square outage mid-charge | Same — no failure count increment | R6 |
| HU API down for extended period | Retries continue without count increment. Future: admin override | E9 |

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

## 13. Suspension After Max Retries

**Scenario matrix refs:** F3, F4

**Process:** After 4th user-fault payment failure, subscription is suspended. Behavior differs by product type and whitelabel.

### P-CO Suspension (F3)

| Whitelabel Behavior | CO Result | HU Result |
|---|---|---|
| `DEACTIVATE_USER` | Role → **SHELL** (zero features, keeps login) | HU access off |
| `DOWNGRADE_TO_FREE` | `is_premium=0`, role unchanged | HU access off |

**In both cases:** SHELL access preserved — user keeps portal login.

### P-HU Suspension (F4)

| Result | Detail |
|---|---|
| HU access off | Paid-Suspended |
| CO untouched | `managed=false` — billing doesn't touch CO |
| User keeps whatever CO access they had | External CO unaffected |

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. 4th payment failure | Max retries exhausted | `payment_failure_count` = 4 |
| 2. Status → `suspended` | `suspension_date` set | Cron stops attempting |
| 3. CO configured per whitelabel | SHELL or is_premium=0 (P-CO only) | User config updated |
| 4. HU access revoked | HU data → Paid-Suspended | HU off |
| 5. Suspension email sent | User notified with card update instructions | Email sent |
| 6. **SHELL preserved** | User can still log in to portal | Role not removed |

### Edge Cases

| Case | Expected Behavior | Matrix Ref |
|---|---|---|
| Card update on suspended sub | Trigger immediate payment. On success → reactivate | F7, E6 |
| Card update fails on suspended sub | Remains suspended, counts as another retry | E6 |
| P-CO user >500 HU contacts then suspended | HU access off entirely (no CO premium = no base) | E2 |

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

## 14. Cancel on Renewal

**Scenario matrix refs:** X1, X2, X3

**Process:** User marks subscription for cancellation. At period end (or trial end), subscription cancelled instead of renewed/converted.

### Behavior by Product Type

| Product | At Period/Trial End | CO Result | HU Result | Matrix Ref |
|---|---|---|---|---|
| P-CO | Cancel at renewal | Per whitelabel (SHELL or is_premium=0) | HU access off | X1 |
| P-HU | Cancel at renewal | CO untouched (external) | HU access off | X2 |
| P-TRIAL | Cancel at trial end (no conversion) | SHELL preserved | HU access off | X3 |

**In all cases:** SHELL access preserved — user keeps portal login.

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. User requests cancellation | `cancel_on_renewal = true` | Flag set |
| 2. Access continues | Until period/trial end | Status still active |
| 3. Cron at renewal/trial end | Detects `cancel_on_renewal` | Skips charge/conversion |
| 4. Subscription deactivated | Status → `inactive` | No payment processed |
| 5. CO configured per product/whitelabel | See table above | User config updated |
| 6. Cancellation email | User notified | Email confirms cancellation |

### Edge Cases

| Case | Expected Behavior |
|---|---|
| Uncancel before renewal | `cancel_on_renewal` cleared, normal renewal resumes |
| Cancel during retry window | Cancel takes precedence over retry |
| Cancel P-TRIAL | No conversion at trial end; HU off; SHELL preserved |

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

## 15. Downgrade on Renewal (P-CO → Free)

**Scenario matrix ref:** D1

**Process:** P-CO user marked for downgrade. At renewal: CO → free, HU base 500 removed, HU access off.

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. `downgrade_on_renewal = true` | Flag set | — |
| 2. Cron at renewal | Detects downgrade flag | Skips normal renewal charge |
| 3. CO downgraded | `is_premium=0` | Premium access removed |
| 4. HU base removed | Was included with CO premium | HU access off entirely |
| 5. Downgrade email | User notified | — |

### Edge Cases

| Case | Expected Behavior | Matrix Ref |
|---|---|---|
| P-CO user >500 contacts then downgrades | At renewal: CO free, HU off entirely (no CO premium = no base) | E2 |
| Un-downgrade before renewal | Flag cleared, normal renewal resumes | — |
| Downgrade + cancel both set | Needs verification — which takes precedence? | — |
| Downgrade user_config update | **Not yet implemented (TODO-003, DISC-005)** | — |

### How to Test

```bash
yarn dev:tools scenario downgrade-on-renewal
yarn dev:tools cron-run <user_id>
yarn dev:tools state <user_id>
# Verify: is_premium=0, HU access off
```

---

## 16. Free Trial: P-TRIAL Lifecycle

**Scenario matrix refs:** P3, R3, R4, E1, X3, PZ3

**Process:** Billing-managed free trial. Card required upfront. CO = SHELL. Auto-converts to paid HU at `trial_ends_at`.

### Full Lifecycle

| Phase | What Happens | Verify |
|---|---|---|
| **Enrollment** | Card required; subscription created; CO=SHELL; HU=Trial-Active | `trial_ends_at` set |
| **During trial** | No charges; trial warning email at 10 days before end | Email sent |
| **Conversion (success)** | Charge card for HU usage; HU→Paid-Active; continues as P-HU | First charge processed |
| **Conversion (failure)** | Enter retry ladder; HU access revoked at `trial_ends_at`; on success, restored | Retry schedule applies |
| **Cancel during trial** | `cancel_on_renewal` → no conversion; HU off; SHELL preserved | X3 |
| **Pause during trial** | Trial paused; `trial_ends_at` **extended** by pause duration on resume | PZ3 |

### Edge Cases

| Case | Expected Behavior | Matrix Ref |
|---|---|---|
| When is HU access revoked on conversion failure? | At `trial_ends_at` (trial benefit ends). Retry continues for payment only. On success, HU restored | E1 |
| P-TRIAL user purchases P-CO before trial end | End trial; upgrade to P-CO; CO premium + HU base | P4, E5 |
| CO deactivated during trial | Trial paused; `trial_ends_at` extended on resume | PZ3 |
| Multiple trial warnings | Only one warning per trial | — |

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
# Verify: conversion charge, HU Paid-Active, SHELL preserved

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

## 17. Free Trial: HU Auto-Trial (Non-Billing)

**Scenario matrix ref:** State Combination #15

**Process:** Existing HU feature — auto-activated on first HU sign-in for free users. **No billing involvement.** No subscription record, no card, no billing system.

| Aspect | Detail |
|---|---|
| Triggered by | First HU sign-in |
| Card required | No |
| Subscription record | None (Homeuptick_Subscriptions only) |
| Auto-converts to paid | No — access simply turned off at expiry |
| Billing involvement | None (except: billing pauses auto-trial on CO deactivation) |

### Billing's Responsibilities

| Event | Billing Action | Matrix Ref |
|---|---|---|
| CO deactivated (webhook) | Tell HU API to pause auto-trial | W2 |
| CO reactivated (webhook) | Tell HU API to resume auto-trial | W5 |
| User purchases P-CO | **Clear auto-trial** (CO premium supersedes) | P5 |
| User starts P-TRIAL | **Clear auto-trial** (P-TRIAL replaces) | P6 |

### How to Test

```bash
# Verify auto-trial pause on CO deactivation
yarn dev:tools webhook user.deactivated <user_id>
# Verify: HU auto-trial paused (check HU API)

# Verify auto-trial cleared on P-CO purchase
# Purchase P-CO for user with auto-trial → auto-trial removed
```

---

## 18. Pause (CO Deactivation via Webhook)

**Scenario matrix refs:** PZ1, PZ2, PZ3, F6, W1, W3

**Process:** CO account deactivated by admin → `user.deactivated` webhook → subscription **paused** regardless of `managed` flag. Paused ≠ Suspended.

### Behavior by Product and State

| Scenario | Result | Matrix Ref |
|---|---|---|
| P-CO active | CO deactivated; HU frozen; no charges; no retries | PZ1 |
| P-HU active | HU frozen; CO external (now deactivated); no charges | PZ2 |
| P-TRIAL active | Trial paused; `trial_ends_at` extended on resume | PZ3 |
| **Any product in retry window** | **Pause stops retries.** Retry resumes from same position on reactivation | F6, W3 |

### Key Distinction: Paused vs Suspended

| Attribute | Paused | Suspended |
|---|---|---|
| Cause | Admin/webhook deactivated CO | Max payment retries exhausted |
| Card update behavior | **Store card only; stay paused** (admin decision) | **Trigger immediate payment; reactivate on success** |
| Resume trigger | `user.activated` webhook | Successful card update payment |
| Retry interaction | Stops retries; resumes from same position | N/A (already past retries) |

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

## 19. Resume (CO Reactivation via Webhook)

**Scenario matrix refs:** PZ4, W4

**Process:** CO account reactivated → `user.activated` webhook → paused subscription resumed. Dates recalculated.

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. `user.activated` webhook | Signature verified | — |
| 2. Paused subs → active | Status changes | `next_renewal_at` recalculated |
| 3. **`next_renewal_at` = today + remaining period** | Time remaining from before pause carried forward | Date correct |
| 4. P-TRIAL: **`trial_ends_at` extended** | Extended by pause duration | Trial time preserved |
| 5. If was in retry window | **Retries resume from same position** | Same `payment_failure_count` |

### Edge Cases

| Case | Expected Behavior | Matrix Ref |
|---|---|---|
| Long pause (months) | Renewal date extends by full paused duration | PZ4 |
| Resume P-TRIAL | `trial_ends_at` extended by pause duration | PZ4 |
| Resume during retry | Retries resume from same `payment_failure_count` position | PZ4 |
| External CO team no longer exists after resume | Sub resumes; if CO deactivated again → another pause | E8 |

### How to Test

```bash
# Full pause/resume cycle
yarn dev:tools scenario renewal-due
yarn dev:tools webhook user.deactivated <user_id>
# ... time passes ...
yarn dev:tools webhook user.activated <user_id>
yarn dev:tools state <user_id>
# Verify: status=active, next_renewal_at recalculated

# Resume P-TRIAL (verify trial_ends_at extended)
yarn dev:tools scenario trial-expiring --product p-trial
yarn dev:tools webhook user.deactivated <user_id>
yarn dev:tools webhook user.activated <user_id>
yarn dev:tools state <user_id>
# Verify: trial_ends_at extended by pause duration
```

---

## 20. Card Update

**Scenario matrix refs:** C1-C5, F5, F7, F8, E6, E7

**Process:** User updates their payment card. Behavior depends on subscription state (active, in retry, suspended, paused).

### Behavior by Subscription State

| State | Card Update Behavior | Matrix Ref |
|---|---|---|
| **Active** | New card stored, used at next renewal | C1 |
| **In retry window** | New card stored, next retry uses it | C2, F5 |
| **Suspended** (max retries) | **Trigger immediate payment.** On success → reactivate. On failure → remains suspended | C3, F7, E6 |
| **Paused** (admin deactivation) | **Store card only. Stay paused.** Paused = admin decision, not billing | C4, F8, E7 |
| **P-TRIAL enrollment** | Required. Stored for auto-conversion at trial end | C5 |

### Critical Distinction

> **Suspended + card update = immediate retry.** Paused + card update = no state change.

### Edge Cases

| Case | Expected Behavior | Matrix Ref |
|---|---|---|
| Card update on suspended sub, payment fails | Remains suspended, counts as another retry | E6 |
| Card update on paused sub | Store card only; stay paused | E7 |
| Invalid card token | Error returned, old card kept | — |
| Card update via manage endpoint | **Not implemented (TODO-001, DISC-001)** | — |

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

## 21. Plan Change (Upgrade)

**Process:** Existing user upgrades to a higher-tier plan with prorated charge.

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. Navigate to Change Plan | Dashboard → "Manage Subscription" → "Change Plan" | Available products shown |
| 2. Select new plan | POST `/api/manage/checkplan` validates compatibility | Role compatibility checked |
| 3. Prorated cost calculated | `(newCost - oldCost) * remainingTimePercent` | Never negative |
| 4. Confirm change | POST `/api/manage/purchase` | Prorated charge + new sub |
| 5. Old subscription deactivated | Previous sub marked inactive | Only one active sub |
| 6. New subscription created | New amount, duration, product_id | `next_renewal_at` set |
| 7. User config updated | Role mapping rules applied | AGENT → TEAMOWNER if single → team |

### Edge Cases

| Case | Expected Behavior |
|---|---|
| Upgrade on day 1 of cycle | Full prorated difference charged |
| Same plan → same plan | Rejected or no-op |
| AGENT ↔ INVESTOR | Role incompatibility — blocked |
| Upgrade during retry window | Clears retry state |
| Prorated cost = $0 | No charge, just switch |

### How to Test

**Frontend:**

1. Navigate to `http://localhost:3000/manage`
2. Log in → "Manage Subscription" → "Change Plan"
3. Select higher-tier plan
4. Verify prorated cost, confirm
5. `yarn dev:tools state <user_id>` — verify new subscription

---

## 22. Plan Change (Downgrade)

**Process:** User switches to a lower-tier plan. Takes effect at next renewal.

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. Select lower plan | Via manage flow | `downgrade_on_renewal = true` |
| 2. Current plan continues | User keeps access until period end | No immediate change |
| 3. Cron at renewal | Detects downgrade flag | New plan applied |
| 4. Role mapping applied | Team → single: TEAMOWNER → AGENT | Correct role |

### Edge Cases

| Case | Expected Behavior |
|---|---|
| Team → single | TEAMOWNER → AGENT role change |
| Downgrade user_config update | **Not yet implemented (TODO-003)** |

---

## 23. Payment Refund

**Process:** Admin refunds a completed payment.

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. POST `/api/payment/refund` | Transaction must exist, not already refunded | Validated |
| 2. Square refund processed | Same environment as original charge | Square confirms |
| 3. Transaction updated | Original marked `refunded`, new refund record | Two records |
| 4. Email sent | Refund confirmation | Email |

### Edge Cases

| Case | Expected Behavior |
|---|---|
| Already refunded | Error — blocked |
| Non-payment transaction | Error — wrong type |
| Partial refund | Not supported (full only) |

### How to Test

```bash
curl -X POST http://localhost:3000/api/payment/refund \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"transaction_id": <id>}'
yarn dev:tools state <user_id>
# Check transactions for refund record
```

---

## 24. Property Unlock

**Process:** One-time $50 charge to unlock a property.

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. POST `/api/property/:property_token` | Token validated | — |
| 2. Property fetched | External API lookup | Property exists |
| 3. Card charged | $50 via Square | Transaction logged |
| 4. Property updated | External API marks unlocked | Status changed |
| 5. Confirmation email | PropertyUnlocked event | Email sent |

### Edge Cases

| Case | Expected Behavior |
|---|---|
| Payment succeeds but property update fails | **Auto-refund issued** |
| Invalid token | Error before charge |
| No card on file | Error |

**No integration test exists (gap). No dev CLI command exists.**

---

## 25. Webhook: User Deactivated

**Scenario matrix refs:** W1, W2, W3, W6

**Process:** CashOffers API notifies billing that a user was deactivated.

### Behavior by User State

| User State | Action | Matrix Ref |
|---|---|---|
| Has active subscription | **Pause subscription** (regardless of `managed` flag) | W1 |
| Has P-TRIAL | **Pause trial**; `trial_ends_at` extended on resume | W1 |
| In retry window | **Pause stops retries**; retry resumes on reactivation | W3 |
| Has HU auto-trial (no subscription) | Tell HU API to pause auto-trial | W2 |
| No subscription, no auto-trial | Log and ignore | W6 |

### How to Test

```bash
# Active subscription
yarn dev:tools scenario renewal-due
yarn dev:tools webhook user.deactivated <user_id>
yarn dev:tools state <user_id>
# Verify: status=paused

# During retry window
yarn dev:tools scenario payment-retry-1
yarn dev:tools webhook user.deactivated <user_id>
yarn dev:tools state <user_id>
# Verify: paused, retries stopped

# User with no subscription
yarn dev:tools webhook user.deactivated <unknown_user_id>
# Verify: logged, no error
```

**Integration test:**

```bash
yarn test api/tests/integration/webhook-cashoffers.test.ts
```

---

## 26. Webhook: User Activated

**Scenario matrix refs:** W4, W5

**Process:** CashOffers API notifies billing that a user was reactivated.

### Behavior by User State

| User State | Action | Matrix Ref |
|---|---|---|
| Has paused subscription | **Resume**: recalculate dates; restore access | W4 |
| Has paused P-TRIAL | **Resume**: extend `trial_ends_at` by pause duration | W4 |
| Had paused auto-trial | Tell HU API to resume auto-trial | W5 |
| No paused subs | No-op | — |

### How to Test

```bash
yarn dev:tools webhook user.deactivated <user_id>   # Pause first
yarn dev:tools webhook user.activated <user_id>      # Resume
yarn dev:tools state <user_id>
# Verify: status=active, dates recalculated
```

---

## 27. Webhook: User Created

**Process:** CashOffers API notifies billing of new user creation.

### Lifecycle

| Step | What Happens | Verify |
|---|---|---|
| 1. Webhook received | `user.created` | Signature verified |
| 2. Check existing subscription | Skip if already has one | No duplicates |
| 3. Create free trial | 90-day trial, SHELL role, HU enabled | Status: `free_trial` |

### Edge Cases

| Case | Expected Behavior |
|---|---|
| User already has active subscription | Trial skipped |
| User already has trial | Trial skipped |

### How to Test

```bash
yarn dev:tools webhook user.created <user_id>
yarn dev:tools state <user_id>
```

---

## 28. Cron: Trial Warning & Expiration

**Process:** Cron handles trial warning emails and trial conversion/expiration.

### Trial Warning (10 days before)

| Step | What Happens | Verify |
|---|---|---|
| 1. Query trials | `trial_ends_at` within 10 days | Correct trials found |
| 2. Warning email | "Your trial expires in X days" | Email sent |
| 3. No state change | Trial continues | Status unchanged |

### Trial Expiration

See [P-TRIAL Conversion](#10-subscription-renewal-p-trial-conversion).

### How to Test

```bash
yarn dev:tools scenario trial-expiring
yarn dev:tools cron-preview
yarn dev:tools cron-run <user_id>
```

---

## 29. Manage Account: Login & View

**Process:** User logs into account management portal.

### Login Flow

| Step | What Happens | Verify |
|---|---|---|
| 1. Navigate to `/manage` | Check existing session | Auto-login if cookie valid |
| 2. Enter email | POST `/api/signup/checkuserexists` | Found → password step |
| 3. Enter password | POST `/api/auth/login` | `_api_token` cookie set |
| 4. Dashboard | Subscription info, action buttons | Correct data shown |

### Edge Cases

| Case | Expected Behavior |
|---|---|
| Invalid email | "User not found" |
| Wrong password | "Invalid credentials" |
| Deactivated user with premium history | Reactivation offer |
| Deep link with goto param | Redirect after login |

**Deep links:** `/manage?goto=dashboard`, `?goto=subscription`, `?goto=card`, `?goto=changePlan`

---

## 30. Email Notifications

### Email Matrix

| Event | Template | Notes |
|---|---|---|
| New user purchase (provisioned) | subscription-created | — |
| New user purchase (provisioning failed) | purchase-error-customer | NOT welcome email |
| Subscription renewed (P-CO) | subscription-renewed | **Must show CO base + HU usage breakdown** |
| Subscription renewed (P-HU) | subscription-renewed | HU charge only |
| P-TRIAL conversion | subscription-renewed | First charge, trial→paid |
| Payment failed | payment-failed | User-fault only |
| Payment refunded | payment-refunded | — |
| Card updated | card-updated | — |
| Subscription cancelled | subscription-cancelled | Per product type behavior |
| Subscription paused | subscription-paused | — |
| Subscription resumed | subscription-resumed | — |
| Subscription suspended | subscription-suspended | Includes card update instructions |
| Subscription downgraded | subscription-downgraded | — |
| Trial started (P-TRIAL) | trial-started | Card required, conversion date shown |
| Trial expiring (10 days) | trial-expiring | Days remaining |
| Trial expired (conversion failed) | trial-expired | — |
| Property unlocked | property-unlocked | — |
| Admin alerts | admin-alert | System errors |

### Renewal Email Requirements (E11)

P-CO renewal emails must indicate:
- HU base included (CO premium users)
- HU usage-based charge amount (if >500 contacts)
- Or "HU trial — converting at [date]" (if P-TRIAL)

### How to Test

```bash
yarn preview:emails
# Open email-previews/index.html in browser
```

- Set `SEND_EMAILS=true` and `DEV_EMAIL=your-email@example.com` to test delivery
- Set `SEND_EMAILS=false` to verify operations complete without emails

---

## 31. Authorization & Permissions

### Auth Flows

| Endpoint Type | Auth Method | Verify |
|---|---|---|
| Standard API routes | Bearer token (JWT from main API) | 401 without token |
| Cron routes | `CRON_SECRET` header | 401 without secret |
| Webhook routes | HMAC-SHA256 signature | 401 with bad signature |
| Health check | No auth | Always 200 |
| Dev routes | Bearer token (non-production only) | 404 in production |

### Edge Cases

| Case | Expected Behavior |
|---|---|
| Expired/invalid token | 401 |
| Non-admin on admin route | 403 |
| Self-access (allowSelf) | Allowed if token owner = resource owner |
| Cross-user access | 403 unless admin |

---

## 32. Sandbox / Test Mode

### How It Works

| Signal | Behavior |
|---|---|
| `?mock_purchase=true` query param | Skips Square entirely |
| Test email pattern (`*@dev-test.local`) | Routes to Square sandbox |
| `SQUARE_ENVIRONMENT=sandbox` | All charges to sandbox |
| Dev routes | Available only when `NODE_ENV !== 'production'` |

---

## Known Gaps & TODOs

| ID | Gap | Impact | Status |
|---|---|---|---|
| TODO-001 / DISC-001 | Square card update via manage endpoint | Users can't update card via manage route stub | Stub returns error |
| TODO-002 / DISC-003 | Suspension cron (auto-suspend after max retries) | 4th failure doesn't auto-suspend | Manual suspension required |
| TODO-003 / DISC-005 | Upgrade/downgrade user_config update | Plan change doesn't update role/premium | Config stale after switch |
| TODO-004 / DISC-002 | HomeUptick tier-based renewal verification | Tier pricing may not calculate correctly | Needs code review |
| DISC-004 | Square webhook handler status | Unclear if Square webhooks are processed | Verify configuration |
| DISC-006 | Suspension user_config revert | Suspended users keep premium config | Config not cleaned up |
| DISC-008 | Permission strings not documented locally | Auth rules reference main API permissions | No local reference |

---

## Testing Checklist Summary

Use this as a go/no-go checklist. Mark each item as you verify it. Items marked with scenario matrix references (e.g., `[P1]`) trace directly to the [Billing Scenario Matrix](../business/capabilities/billing-scenario-matrix.md).

### Purchase / Enrollment

- [ ] P-CO purchase — new user (CO premium + HU base 500) `[P1]`
- [ ] P-CO purchase — user had HU auto-trial (auto-trial cleared) `[P5]`
- [ ] P-CO purchase — user had P-TRIAL (trial ended, upgraded) `[P4]`
- [ ] P-HU purchase — external CO user (managed=false, CO untouched) `[P2]`
- [ ] P-HU purchase — KW/team member `[P7]`
- [ ] P-TRIAL enrollment — card required, CO=SHELL, HU=Trial-Active `[P3]`
- [ ] P-TRIAL enrollment — user had auto-trial (auto-trial cleared) `[P6]`
- [ ] Free signup (no card, amount=0)
- [ ] Investor signup (additional consent, role=INVESTOR)
- [ ] Team plan signup (TEAMOWNER role, team name step)
- [ ] Whitelabel signup (at least 2 whitelabels)
- [ ] Duplicate email handling
- [ ] Card decline on signup
- [ ] Mock purchase mode

### Subscription Renewal

- [ ] P-CO renewal — combined CO base + HU usage charge `[R1]`
- [ ] P-CO renewal — user ≤500 contacts (HU usage = $0, base included)
- [ ] P-CO renewal — user >500 contacts (HU usage-based tier charged)
- [ ] P-HU renewal — HU-only usage-based charge `[R2]`
- [ ] P-TRIAL conversion — auto-convert at trial_ends_at `[R3]`
- [ ] P-TRIAL conversion failure — enters retry ladder `[R4]`
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

- [ ] P-CO suspended — whitelabel DEACTIVATE_USER → role=SHELL `[F3]`
- [ ] P-CO suspended — whitelabel DOWNGRADE_TO_FREE → is_premium=0, role unchanged `[F3]`
- [ ] P-HU suspended — HU off, CO untouched `[F4]`
- [ ] SHELL preserved in all suspension scenarios
- [ ] Card update on suspended sub → immediate payment → reactivate `[F7, E6]`
- [ ] Card update on suspended, payment fails → remains suspended `[E6]`

### Cancel / Downgrade

- [ ] cancel_on_renewal P-CO — CO per whitelabel, HU off, SHELL preserved `[X1]`
- [ ] cancel_on_renewal P-HU — HU off, CO untouched `[X2]`
- [ ] cancel_on_renewal P-TRIAL — no conversion, HU off, SHELL preserved `[X3]`
- [ ] Immediate cancellation (admin) `[X4]`
- [ ] Uncancel before renewal
- [ ] Downgrade P-CO → free (is_premium=0, HU base removed, HU off) `[D1]`
- [ ] P-CO user >500 contacts then downgrade → HU off entirely `[E2]`

### Free Trials

- [ ] P-TRIAL enrollment (card required, CO=SHELL) `[P3]`
- [ ] P-TRIAL warning email (10 days before)
- [ ] P-TRIAL → paid conversion (success, charge card) `[R3]`
- [ ] P-TRIAL → conversion failure (retry ladder, HU revoked at trial_ends_at) `[R4, E1]`
- [ ] P-TRIAL cancel during trial (no conversion, HU off) `[X3]`
- [ ] P-TRIAL paused (trial_ends_at extended on resume) `[PZ3]`
- [ ] P-TRIAL user purchases P-CO before trial end `[P4, E5]`
- [ ] HU auto-trial — billing pauses on CO deactivation `[W2]`
- [ ] HU auto-trial — billing resumes on CO reactivation `[W5]`
- [ ] HU auto-trial cleared on P-CO purchase `[P5]`
- [ ] HU auto-trial cleared on P-TRIAL enrollment `[P6]`

### Pause / Resume

- [ ] Pause P-CO (CO deactivated, HU frozen, no charges) `[PZ1]`
- [ ] Pause P-HU (HU frozen, CO external) `[PZ2]`
- [ ] Pause P-TRIAL (trial paused, trial_ends_at extended on resume) `[PZ3]`
- [ ] Pause during retry window → retries stop `[F6]`
- [ ] Resume any → next_renewal_at recalculated (today + remaining) `[PZ4]`
- [ ] Resume P-TRIAL → trial_ends_at extended by pause duration `[PZ4]`
- [ ] Resume from retry → retries resume from same position `[PZ4]`
- [ ] Long pause → renewal date extends by full paused duration

### Card Management

- [ ] Card replaced on active sub → used at next renewal `[C1]`
- [ ] Card replaced during retry → next retry uses new card `[C2]`
- [ ] Card replaced on **suspended** sub → immediate payment → reactivate `[C3]`
- [ ] Card replaced on **paused** sub → store card only, stay paused `[C4]`
- [ ] Card at P-TRIAL enrollment → stored for conversion `[C5]`

### Webhooks

- [ ] user.deactivated — active subscription → paused `[W1]`
- [ ] user.deactivated — P-TRIAL → trial paused `[W1]`
- [ ] user.deactivated — in retry window → pause stops retries `[W3]`
- [ ] user.deactivated — HU auto-trial → pause auto-trial `[W2]`
- [ ] user.deactivated — no subscription → log and ignore `[W6]`
- [ ] user.activated — paused subscription → resumed `[W4]`
- [ ] user.activated — paused auto-trial → resumed `[W5]`
- [ ] user.created → free trial created
- [ ] Invalid webhook signature → 401 rejected

### Edge Cases

- [ ] P-TRIAL conversion fails — HU revoked at trial_ends_at, retry continues `[E1]`
- [ ] P-CO user >500 contacts, downgrades → no HU access at all `[E2]`
- [ ] P-HU user external CO team ends → webhook pause → resume cycle `[E3]`
- [ ] Auto-trial AND P-TRIAL → auto-trial cleared `[E4]`
- [ ] P-TRIAL user purchases P-CO → trial ended, CO premium `[E5]`
- [ ] Suspended user card update → immediate payment attempt `[E6]`
- [ ] Paused user card update → card stored, stay paused `[E7]`
- [ ] P-HU: CO deactivated, paused, reactivated, team gone → another pause `[E8]`
- [ ] HU API down extended → retries without failure_count increment `[E9]`
- [ ] user.deactivated for unknown user → log and ignore `[E10]`
- [ ] Renewal email shows correct HU info per user type `[E11]`

### Emails

- [ ] All email templates render (preview:emails)
- [ ] P-CO renewal email: CO base + HU usage breakdown `[E11]`
- [ ] P-TRIAL conversion email: first charge shown
- [ ] Suspension email: card update instructions
- [ ] DEV_EMAIL redirect works
- [ ] SEND_EMAILS=false doesn't block operations

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
