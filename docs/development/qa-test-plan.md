# QA Test Plan — Go-Live Migration

Complete walkthrough of every system process, its lifecycle, edge cases, and how to test each step. Designed so a developer can work through every item sequentially and have full confidence that every case is accounted for.

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

1. [New User Signup (Paid)](#1-new-user-signup-paid)
2. [New User Signup (Free)](#2-new-user-signup-free)
3. [New User Signup (Investor)](#3-new-user-signup-investor)
4. [New User Signup (Team Plan)](#4-new-user-signup-team-plan)
5. [Whitelabel Signup](#5-whitelabel-signup)
6. [Subscription Renewal (Success)](#6-subscription-renewal-success)
7. [Subscription Renewal (Payment Failure + Retry)](#7-subscription-renewal-payment-failure--retry)
8. [Subscription Renewal (Cancel on Renewal)](#8-subscription-renewal-cancel-on-renewal)
9. [Subscription Renewal (Downgrade on Renewal)](#9-subscription-renewal-downgrade-on-renewal)
10. [Free Trial Lifecycle](#10-free-trial-lifecycle)
11. [Pause and Resume](#11-pause-and-resume)
12. [Plan Change (Upgrade)](#12-plan-change-upgrade)
13. [Plan Change (Downgrade)](#13-plan-change-downgrade)
14. [Card Update](#14-card-update)
15. [Payment Refund](#15-payment-refund)
16. [Property Unlock](#16-property-unlock)
17. [HomeUptick Addon Renewal](#17-homeuptick-addon-renewal)
18. [Webhook: User Deactivated](#18-webhook-user-deactivated)
19. [Webhook: User Activated](#19-webhook-user-activated)
20. [Webhook: User Created (Free Trial)](#20-webhook-user-created-free-trial)
21. [Cron: Trial Expiration Warning](#21-cron-trial-expiration-warning)
22. [Cron: Trial Expiration](#22-cron-trial-expiration)
23. [Suspension After Max Retries](#23-suspension-after-max-retries)
24. [Manage Account: Login Flow](#24-manage-account-login-flow)
25. [Manage Account: View Subscription](#25-manage-account-view-subscription)
26. [Email Notifications](#26-email-notifications)
27. [Authorization & Permissions](#27-authorization--permissions)
28. [Sandbox / Test Mode](#28-sandbox--test-mode)

---

## 1. New User Signup (Paid)

**Process:** A new user creates an account with a paid subscription via the frontend checkout flow.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Land on pricing page | Products load filtered by whitelabel | Products display with correct prices |
| 2. Click "Sign Up" on a product | Navigates to subscribe flow | URL is `/{whitelabel}/subscribe/{product}` |
| 3. Enter email | System checks if user exists | New user proceeds; existing user gets reactivation offer |
| 4. Enter name | Captured for user profile | Min 2 chars validated |
| 5. Enter slug | Checks availability via API | Duplicate slugs rejected, unique suggestion offered |
| 6. Enter phone | Captured for user profile | Min 10 digits validated |
| 7. Enter card details | Square tokenizes card in browser | Card nonce generated (no PCI data hits our server) |
| 8. Review & accept terms | All consents displayed | TOS, general consent, communication consent checkboxes required |
| 9. Submit | Backend processes purchase | See backend steps below |
| 10. Welcome screen | Success confirmation | User directed to set password |

**Backend steps on submit (POST `/api/purchase/new`):**

| Step | What Happens | Verify |
|------|-------------|--------|
| A | Validate product exists and is active | Invalid product → 400 error |
| B | Create card in Square with null user_id | Card created in Square sandbox/production |
| C | Charge signup fee via Square | Transaction logged, amount matches product `signup_fee` |
| D | Create user in main API with `user_config` from product | User exists in main API with correct role, premium, whitelabel |
| E | Bind card to new user | UserCards record links user_id to Square card_id |
| F | Create subscription record | Status: `active`, `next_renewal_at` = now + duration |
| G | Emit SubscriptionCreated event | Premium activation handler fires → user `active=1`, `is_premium=1` |
| H | Send confirmation email | Email received (or logged if SEND_EMAILS=false) |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| Duplicate email | Frontend shows "account exists" with reactivation offer | Enter an email that exists in main API |
| Card declined | Error shown on review step, user can retry | Use Square test card `4000000000000002` (decline) |
| Payment succeeds but user creation fails | No refund; admin alerted for manual provisioning; customer emailed | Requires mocking main API failure |
| Product not found / inactive | 400 error before any charges | Use invalid product ID |
| Slug already taken | Frontend shows error, suggests alternative | Enter a slug that exists |
| Network timeout on Square | Error displayed, no charge | Disconnect from network during submit |
| Missing required fields | Frontend validation prevents submit | Leave fields empty |

### How to Test

**Frontend (manual):**
1. Navigate to `http://localhost:3000` (or `http://localhost:3000/{whitelabel}`)
2. Click "Sign Up" on any paid product
3. Walk through each step of the form
4. Use `?mock_purchase=true` query param to skip real Square charges
5. Verify welcome screen appears

**Dev CLI (backend only):**
```bash
# Create a user + subscription in renewal-due state (simulates completed purchase)
yarn dev:tools scenario renewal-due --email test-newuser@dev-test.local

# Inspect the created state
yarn dev:tools state <user_id>

# Clean up after testing
yarn dev:tools cleanup <user_id>
```

**Integration test:**
```bash
yarn test api/tests/integration/cashoffers-module.test.ts
```

---

## 2. New User Signup (Free)

**Process:** A new user creates a free account (no payment required).

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Select free product | Card step is skipped entirely | No Square form shown |
| 2. Complete form (email, name, slug, phone) | Standard validation | All fields captured |
| 3. Submit | POST `/api/purchase/new` (card fields omitted) | No payment processed |
| 4. User created in main API | `user_config` from free product applied | Role = product config role, `is_premium` per product |
| 5. Subscription created | Status: `active`, amount: 0 | No renewal charges will occur |
| 6. Welcome screen | Success | User directed to set password |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| Free product with signup_fee > 0 | Should not exist, but if it does: charge applies | Check product config |
| User already exists | Reactivation offer shown | Enter existing email |
| Free → paid upgrade later | Handled via manage flow plan change | Test after free signup |

### How to Test

**Frontend:**
1. Navigate to `http://localhost:3000/{whitelabel}/subscribe/{free_product_id}` (use the numeric product ID for the free product, e.g., 51 for Free Agent)
2. Complete form — card step should be skipped (frontend detects $0 pricing via `isProductFree()`)
3. Verify subscription created with amount=0: `yarn dev:tools state <user_id>`
4. Verify no Square transaction: transaction record has `square_transaction_id = null`
5. Verify no subscription-created or renewal emails sent for $0 amount

---

## 3. New User Signup (Investor)

**Process:** Investor-specific signup with additional consent requirements.

### Lifecycle

Same as [New User Signup (Paid)](#1-new-user-signup-paid) with these differences:

| Difference | Detail |
|-----------|--------|
| Entry point | `/investor` or product with investor role |
| Additional consent | Investor-specific consent checkbox required on review step |
| Role | Product `user_config.role` = `INVESTOR` |
| Slug step | Skipped (investors don't get lead capture pages) |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| Investor tries to switch to AGENT plan | Role incompatibility — blocked by `checkplan` | Via manage flow → Change Plan |
| AGENT tries to switch to investor plan | Role incompatibility — blocked | Via manage flow → Change Plan |

### How to Test

**Frontend:**
1. Navigate to `http://localhost:3000/investor`
2. Verify investor consent checkbox appears on review step
3. Complete signup, verify user role is INVESTOR in main API

---

## 4. New User Signup (Team Plan)

**Process:** User signs up for a team plan, gets TEAMOWNER role.

### Lifecycle

Same as [New User Signup (Paid)](#1-new-user-signup-paid) with these differences:

| Difference | Detail |
|-----------|--------|
| Product | `is_team_plan: true` in product data |
| Role | `user_config.role` = `TEAMOWNER` |
| Slug step | Included — team gets a slug |
| Team step | Additional "Team Name" step appears |
| Broker step | May appear depending on whitelabel (e.g., Keller Williams) |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| Team plan → single plan downgrade | Role changes to AGENT (role mapping rule) | Mark for downgrade, run cron |
| Single plan → team plan upgrade | Role changes to TEAMOWNER (role mapping rule) | Via manage flow → Change Plan |

### How to Test

**Frontend:**
1. Navigate to signup and select a team product
2. Verify Team Name step appears
3. Verify slug step appears
4. Complete signup, verify role is TEAMOWNER

---

## 5. Whitelabel Signup

**Process:** Partner-branded signup flow with whitelabel-specific products and branding.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Navigate to `/{whitelabel_code}` | Whitelabel branding loads from DB | Correct logo, colors, partner name |
| 2. Products filtered | Only products for this whitelabel shown | Products match whitelabel config |
| 3. Signup flow | Standard flow with whitelabel branding | `white_label_id` set on user |
| 4. Emails | Whitelabel-specific templates used (if configured) | Email uses partner branding |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| Invalid whitelabel code | 404 or fallback to default | Navigate to `/invalid-code` |
| Whitelabel with no products | Empty pricing page | Check whitelabel with no assigned products |
| Whitelabel-specific email template missing | Falls back to default template | Check email after signup |

### How to Test

**Frontend:**
1. Navigate to `http://localhost:3000/kw` (Keller Williams)
2. Verify KW branding (logo, colors)
3. Verify only KW products shown
4. Complete signup, verify `white_label_id` set on user

**Known whitelabel codes:** `kw`, `yhs`, `uco`, `mop`, `eco`, `platinum`

---

## 6. Subscription Renewal (Success)

**Process:** Cron finds an active subscription due for renewal and successfully charges.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Cron triggered | POST `/api/cron/subscriptions` with CRON_SECRET | Endpoint responds 200 |
| 2. Query due subscriptions | `next_renewal_at <= now` AND status IN (active) | Correct subscriptions found |
| 3. Check user active in main API | Fetches user from main API | Active users proceed, inactive skipped |
| 4. Check cancel/downgrade flags | Neither flag set | Proceeds to charge |
| 5. Charge via Square | Amount = subscription amount | Transaction logged as "renewal" |
| 6. Update next_renewal_at | now + subscription duration | Date advanced correctly |
| 7. Reset retry counter | `next_renewal_attempt` cleared | No retry window active |
| 8. Emit SubscriptionRenewed | Premium activation handler fires | User stays `active=1`, `is_premium=1` |
| 9. Send renewal email | Receipt email sent | Email contains correct amount and dates |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| User inactive in main API | Subscription skipped entirely (no charge) | `yarn dev:tools webhook user.deactivated <user_id>` then cron |
| Subscription paused | Not picked up by cron query | `yarn dev:tools set-state <sub_id> status=paused` |
| Multiple subscriptions due | Each processed independently | Create two scenarios |
| Square API down | Payment fails → retry scheduled | Requires Square outage or mock |
| Subscription amount = 0 | Should still renew (advance date, no charge) | Set amount to 0 |

### How to Test

**Dev CLI:**
```bash
# Create subscription due for renewal
yarn dev:tools scenario renewal-due

# Preview what cron will do
yarn dev:tools cron-preview

# Run renewal for specific user
yarn dev:tools cron-run <user_id>

# Verify updated state
yarn dev:tools state <user_id>
```

**Integration test:**
```bash
yarn test api/tests/integration/cashoffers-module.test.ts
```

---

## 7. Subscription Renewal (Payment Failure + Retry)

**Process:** Renewal payment fails and system schedules escalating retries.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Renewal attempted | Square charge fails (declined, expired, etc.) | PaymentFailed event emitted |
| 2. Failure logged | Transaction record with failure status | Transaction visible in state |
| 3. Failure email sent | User notified of failed payment | Email sent |
| 4. Retry scheduled | `next_renewal_attempt` set based on attempt count | See retry schedule below |
| 5. Next cron run | Picks up subscription where `next_renewal_attempt <= now` | Only retries when window opens |

**Retry schedule:**

| Attempt | Wait Time | `next_renewal_attempt` set to |
|---------|-----------|------------------------------|
| 1st failure | +1 day | now + 1 day |
| 2nd failure | +3 days | now + 3 days |
| 3rd failure | +7 days | now + 7 days |
| 4th failure | Suspend | **NOT YET AUTOMATED** (TODO-002) |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| User updates card during retry window | New card used on next retry attempt | Update card, then cron-run |
| Card update triggers immediate retry | CardUpdated event → retry handler fires | Update card via manage flow |
| All retries exhausted | Suspension (currently manual — TODO-002) | Run through all 3 retry scenarios |
| User cancels during retry window | cancel_on_renewal flag respected on next attempt | Set cancel flag during retry |

### How to Test

**Dev CLI:**
```bash
# Create subscription in first retry state
yarn dev:tools scenario payment-retry-1

# Verify retry window
yarn dev:tools state <user_id>

# Create second retry state
yarn dev:tools scenario payment-retry-2

# Run cron to trigger retry
yarn dev:tools cron-run <user_id>

# Manually advance through retry states
yarn dev:tools set-state <sub_id> next_renewal_attempt=2025-01-01T00:00:00Z
```

**Integration test:**
```bash
yarn test api/tests/integration/retry-and-suspension.test.ts
yarn test api/tests/integration/card-update-retry.test.ts
```

---

## 8. Subscription Renewal (Cancel on Renewal)

**Process:** User marks subscription for cancellation; cron cancels instead of charging at next renewal.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. User requests cancellation | POST `/api/subscription/:id/cancel` | `cancel_on_renewal = true` |
| 2. Subscription stays active | User keeps access until period ends | Status still `active` |
| 3. Cron runs at renewal time | Detects `cancel_on_renewal = true` | Skips charge |
| 4. Subscription deactivated | Status → `inactive` | No payment processed |
| 5. Cancellation email sent | User notified | Email confirms cancellation |
| 6. User deactivated in main API | `active=0`, `is_premium=0` | User loses premium access |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| User uncancels before renewal | `cancel_on_renewal` cleared, normal renewal resumes | POST `/api/subscription/:id/uncancel` |
| Cancel + retry window active | Cancel takes precedence over retry | Set both flags |
| Cancel on free subscription | Subscription deactivated, no charge attempt | Cancel a free sub |

### How to Test

**Dev CLI:**
```bash
# Create scenario with cancel flag set
yarn dev:tools scenario cancel-on-renewal

# Preview cron behavior
yarn dev:tools cron-preview

# Run cron
yarn dev:tools cron-run <user_id>

# Verify cancelled state
yarn dev:tools state <user_id>
```

**Manual flag toggle:**
```bash
# Set cancel flag
yarn dev:tools set-state <sub_id> cancel_on_renewal=true

# Clear cancel flag (uncancel)
yarn dev:tools set-state <sub_id> cancel_on_renewal=false
```

**Frontend (manage flow):**
1. Log in at `/manage`
2. Go to "Manage Your Subscription"
3. Cancel subscription (if UI supports it — verify button exists)

**Integration test:**
```bash
yarn test api/tests/integration/cashoffers-module.test.ts
```

---

## 9. Subscription Renewal (Downgrade on Renewal)

**Process:** User marks subscription for downgrade; cron downgrades instead of renewing at current tier.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. User requests downgrade | POST `/api/subscription/:id/downgrade` | `downgrade_on_renewal = true` |
| 2. Subscription stays active at current tier | User keeps current access until period ends | Status still `active` |
| 3. Cron runs at renewal time | Detects `downgrade_on_renewal = true` | Skips normal renewal |
| 4. Downgrade applied | New product/amount applied | **Implementation incomplete (TODO-003)** |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| User un-downgrades before renewal | `downgrade_on_renewal` cleared, normal renewal | POST `/api/subscription/:id/undowngrade` |
| Downgrade + cancel both set | Behavior unclear — needs verification | Set both flags |
| Team → single downgrade | Role changes TEAMOWNER → AGENT | Role mapping rules |
| Downgrade user_config update | New product config applied to user | **Not yet implemented (TODO-003, DISC-005)** |

### How to Test

**Dev CLI:**
```bash
# Create scenario with downgrade flag
yarn dev:tools scenario downgrade-on-renewal

# Preview cron
yarn dev:tools cron-preview

# Run cron
yarn dev:tools cron-run <user_id>

# Verify state
yarn dev:tools state <user_id>
```

**Integration test:**
```bash
yarn test api/tests/integration/cashoffers-module.test.ts
```

---

## 10. Free Trial Lifecycle

**Process:** User starts on a free trial, system converts to paid or cancels at expiration.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Trial created | Status: `free_trial`, `trial_ends_at` set (90 days default) | No payment charged |
| 2. Trial warning (10 days before expiry) | Cron sends "trial expiring" email | Email with days remaining |
| 3. Trial expires | Cron detects `trial_ends_at <= now` | Status changes |
| 4a. Payment succeeds | Status: `free_trial → active`, `next_renewal_at` set | First charge processed |
| 4b. Payment fails | Status: `free_trial → inactive` | **No retry** (differs from renewal retry) |
| 5. Emails sent | Success: renewal email. Failure: trial-expired email | Correct template used |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| Trial user has no card on file | Payment fails → inactive | Create trial without card |
| Trial payment fails | Immediately inactive — NO retry schedule | Unlike renewal failures |
| User cancels during trial | cancel_on_renewal respected | Set flag during trial |
| Trial with HomeUptick addon | Addon trial also managed | Check homeuptick free_trial config |
| Multiple trial warnings | Only one warning per trial | Run cron multiple times in warning window |

### How to Test

**Dev CLI:**
```bash
# Create trial expiring in 9 days (triggers warning)
yarn dev:tools scenario trial-expiring

# Create trial already expired (triggers conversion)
yarn dev:tools scenario trial-expired

# Preview cron to see trial actions
yarn dev:tools cron-preview

# Run cron
yarn dev:tools cron-run <user_id>

# Verify state after
yarn dev:tools state <user_id>
```

**Integration test:**
```bash
yarn test api/tests/integration/free-trial.test.ts
```

---

## 11. Pause and Resume

**Process:** Subscription is paused (suspended), then later resumed with adjusted renewal date.

### Pause Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Pause requested | POST `/api/subscription/:id/pause` | Status: `active → suspended` |
| 2. Suspension date recorded | `suspension_date` set to now | Timestamp stored |
| 3. Cron skips | Paused subs not in renewal query | `cron-preview` shows no action |
| 4. Pause email sent | User notified | Email confirms pause |
| 5. SubscriptionPaused event | Logged, side effects fire | Transaction log updated |

### Resume Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Resume requested | POST `/api/subscription/:id/resume` | Status: `suspended → active` |
| 2. Renewal date recalculated | Remaining days from pause carried forward | `next_renewal_at` = now + remaining days |
| 3. Suspension date cleared | `suspension_date = null` | Field cleared |
| 4. Resume email sent | User notified | Email confirms resume |
| 5. SubscriptionResumed event | Logged, side effects fire | Transaction log updated |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| Pause a non-active subscription | Error — can only pause active subs | Try pausing cancelled/trial sub |
| Resume a non-suspended subscription | Error — can only resume suspended subs | Try resuming active sub |
| Pause during retry window | Retry stops, suspension takes precedence | Set retry then pause |
| Long pause (months) | Renewal date extends by paused duration | Pause, wait, resume, check date |
| Pause → cancel (not resume) | Should be possible — deactivate while paused | Verify flow exists |

### How to Test

**Dev CLI:**
```bash
# Create a paused subscription
yarn dev:tools scenario paused

# Or pause an existing one
yarn dev:tools set-state <sub_id> status=paused

# Verify cron skips it
yarn dev:tools cron-preview

# Resume (requires API call — no CLI command yet)
# Use curl or frontend manage flow
curl -X POST http://localhost:3000/api/subscription/<sub_id>/resume \
  -H "Authorization: Bearer <token>"

# Verify resumed state
yarn dev:tools state <user_id>
```

**Frontend (manage flow):**
1. Log in at `/manage`
2. Go to "Manage Your Subscription"
3. Pause subscription (if button exists)
4. Log back in, resume subscription

**Integration test:**
```bash
yarn test api/tests/integration/pause-resume.test.ts
```

---

## 12. Plan Change (Upgrade)

**Process:** Existing user upgrades to a higher-tier plan with prorated charge.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. User logs into manage flow | `/manage` → email → password → dashboard | Session established |
| 2. Navigate to Change Plan | Dashboard → "Manage Subscription" → "Change Plan" | Available products shown |
| 3. Select new plan | POST `/api/manage/checkplan` validates compatibility | Role compatibility checked |
| 4. Prorated cost calculated | `(newCost - oldCost) * remainingTimePercent` | Never negative |
| 5. Confirm change | POST `/api/manage/purchase` | Prorated charge + new sub created |
| 6. Old subscription deactivated | Previous sub marked inactive | Only one active sub |
| 7. New subscription created | New amount, duration, product_id | `next_renewal_at` set |
| 8. User config updated | Role mapping rules applied | AGENT → TEAMOWNER if single → team |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| Upgrade on day 1 of billing cycle | Full prorated difference charged | Upgrade immediately after renewal |
| Upgrade on last day of cycle | Minimal prorated charge (~0) | Set renewal_date to tomorrow, upgrade |
| Same plan → same plan | Should be rejected or no-op | Try selecting current plan |
| AGENT → INVESTOR | Role incompatibility — blocked | Select investor product as AGENT |
| INVESTOR → AGENT | Role incompatibility — blocked | Select agent product as INVESTOR |
| No card on file | Must add card first | Remove card, try upgrade |
| Upgrade during retry window | Clears retry state | Upgrade while in payment-retry |
| Prorated cost = $0 | No charge, just switch | Same-price plan switch |

### How to Test

**Frontend:**
1. Navigate to `http://localhost:3000/manage`
2. Log in with existing user credentials
3. Go to "Manage Your Subscription" → "Change Plan"
4. Select a higher-tier plan
5. Verify prorated cost displayed
6. Confirm change
7. Verify new subscription active: `yarn dev:tools state <user_id>`

---

## 13. Plan Change (Downgrade)

**Process:** User switches to a lower-tier plan. Takes effect at next renewal.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. User selects lower plan | Via manage flow or API | `downgrade_on_renewal = true` |
| 2. Current plan continues | User keeps access at current tier | No immediate change |
| 3. Cron at renewal | Detects downgrade flag | Applies new plan instead of renewing current |
| 4. New plan active | Lower amount, potentially different role | Role mapping rules applied |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| Team → single | TEAMOWNER → AGENT role change | Downgrade team plan |
| Downgrade + user_config update | **Not yet implemented (TODO-003)** | Verify behavior |
| Un-downgrade before renewal | Flag cleared, normal renewal resumes | POST undowngrade |

### How to Test

See [Subscription Renewal (Downgrade on Renewal)](#9-subscription-renewal-downgrade-on-renewal).

---

## 14. Card Update

**Process:** User updates their payment card on file.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. User navigates to card update | Manage flow → "Update Your Billing Info" | Square form displayed |
| 2. Enter new card | Square tokenizes in browser | Card nonce generated |
| 3. Submit | POST `/api/card` with nonce | Card created in Square |
| 4. UserCards record updated | New card_id stored | Old card replaced |
| 5. CardUpdated event emitted | Triggers retry handler if in retry window | Immediate renewal retry attempted |
| 6. Confirmation email | Card updated notification | Email sent |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| Card update during retry window | Immediate retry with new card | Set up payment-retry scenario, update card |
| Card update on suspended subscription | Retry attempted, may reactivate | Suspend sub, update card |
| Invalid card token | Error returned, old card kept | Use invalid Square test nonce |
| Card update via manage endpoint | **Not implemented (TODO-001, DISC-001)** | Verify stub returns appropriate error |

### How to Test

**Frontend:**
1. Navigate to `http://localhost:3000/manage`
2. Log in
3. Click "Update Your Billing Info"
4. Enter new card details
5. Submit and verify confirmation

**Dev CLI (verify state):**
```bash
yarn dev:tools state <user_id>
# Check card section for updated last 4, expiry, environment
```

**Integration test:**
```bash
yarn test api/tests/integration/card-update-retry.test.ts
```

---

## 15. Payment Refund

**Process:** Admin refunds a completed payment.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Refund requested | POST `/api/payment/refund` with transaction_id | Transaction must exist and not already refunded |
| 2. Only "payment" type | Validates transaction type | Non-payment types rejected |
| 3. Square refund processed | Refund in same environment as original charge | Square confirms refund |
| 4. Transaction updated | Original marked `refunded`, new refund record created | Two transaction records |
| 5. PaymentRefunded event | Email sent, admin notified | Refund confirmation email |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| Refund already-refunded transaction | Error — already refunded | Try refunding twice |
| Refund non-payment transaction | Error — wrong type | Try refunding a log entry |
| Partial refund | Not supported (full refund only) | Verify no partial option |
| Refund sandbox payment from production | Uses same environment as original | Check square_environment on transaction |
| Refund after subscription cancelled | Refund still processes | Cancel then refund |

### How to Test

**API (admin):**
```bash
curl -X POST http://localhost:3000/api/payment/refund \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"transaction_id": <id>}'
```

**Verify:**
```bash
yarn dev:tools state <user_id>
# Check transactions for refund record
```

---

## 16. Property Unlock

**Process:** One-time $50 charge to unlock a property.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Request | POST `/api/property/:property_token` | Token validated |
| 2. Property fetched | External API lookup | Property exists |
| 3. Card charged | $50 (5000 cents) via Square | Transaction logged |
| 4. Property updated | External API marks property unlocked | Property status changed |
| 5. Confirmation email | PropertyUnlocked event fires | Email sent |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| Payment succeeds but property update fails | **Auto-refund issued** (critical rollback) | Mock property API failure |
| Invalid property token | Error before charge | Use fake token |
| No card on file | Error — card required | Remove card first |
| Property already unlocked | Behavior unclear — verify | Try unlocking twice |

### How to Test

**No integration test exists (gap).** No dev CLI command exists.

**API:**
```bash
curl -X POST http://localhost:3000/api/property/<token> \
  -H "Authorization: Bearer <user_token>" \
  -H "Content-Type: application/json" \
  -d '{"card_token": "<nonce>"}'
```

---

## 17. HomeUptick Addon Renewal

**Process:** HomeUptick addon subscription renewed alongside main subscription.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Main subscription due | Cron processes main renewal first | Main renewal succeeds |
| 2. Check for addon | Query for HomeUptick subscription linked to user | Addon found |
| 3. Fetch tier from HomeUptick API | GET client count → calculate tier | Correct tier returned |
| 4. Calculate addon cost | Tier-based pricing from product config | Amount matches tier |
| 5. Charge addon | Separate Square charge | Separate transaction logged |
| 6. Update addon renewal date | `next_renewal_at` advanced | Addon date updated |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| HomeUptick API unavailable | Addon fails, main renewal still succeeds | Mock API unavailability |
| Tier changed since last renewal | New tier cost applied | Change client count in HomeUptick |
| Main renewal fails | Addon not attempted | Fail main payment |
| Addon has no card | Uses same card as main subscription | Verify card resolution |
| Tier-based renewal cost | **Implementation needs verification (TODO-004, DISC-002)** | Check renew-subscription.use-case.ts:114 |

### How to Test

**Integration test:**
```bash
yarn test api/tests/integration/homeuptick-module.test.ts
yarn test api/tests/integration/renewal-homeuptick-tiers.test.ts
```

**No dev CLI scenario available (gap).**

---

## 18. Webhook: User Deactivated

**Process:** Main CashOffers API notifies billing that a user was deactivated.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Webhook received | POST `/api/webhooks/cashoffers` with `user.deactivated` | HMAC-SHA256 signature verified |
| 2. Handler processes | CashOffersWebhookHandler invoked | Event type matched |
| 3. Active subscriptions paused | All active subs → `suspended` | Status changes |
| 4. Next cron run | Suspended subs skipped | No charges |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| User has no subscriptions | No-op, webhook acknowledged | Send webhook for user without subs |
| User already suspended | No-op for already-suspended subs | Deactivate already-paused user |
| Invalid signature | 401 rejected | Send webhook without correct HMAC |
| Unknown user_id | Handled gracefully | Send webhook for non-existent user |

### How to Test

**Dev CLI:**
```bash
# Create a user with active subscription first
yarn dev:tools scenario renewal-due

# Fire deactivation webhook
yarn dev:tools webhook user.deactivated <user_id>

# Verify subscription suspended
yarn dev:tools state <user_id>

# Verify cron will skip
yarn dev:tools cron-preview
```

**Integration test:**
```bash
yarn test api/tests/integration/webhook-cashoffers.test.ts
```

---

## 19. Webhook: User Activated

**Process:** Main API notifies billing that a previously deactivated user was reactivated.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Webhook received | POST `/api/webhooks/cashoffers` with `user.activated` | Signature verified |
| 2. Handler processes | Suspended subs → `active` | Status changes |
| 3. Renewal dates recalculated | Remaining time from pause carried forward | `next_renewal_at` adjusted |
| 4. Next cron run | Renewed normally when due | Subscription back in rotation |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| User with no suspended subs | No-op | Activate user with active subs |
| Long deactivation period | Renewal date adjusted by full paused duration | Deactivate, wait, reactivate |

### How to Test

**Dev CLI:**
```bash
# Deactivate first
yarn dev:tools webhook user.deactivated <user_id>

# Then reactivate
yarn dev:tools webhook user.activated <user_id>

# Verify resumed state
yarn dev:tools state <user_id>
```

---

## 20. Webhook: User Created (Free Trial)

**Process:** Main API notifies billing that a new free user was created, triggers free trial.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Webhook received | POST `/api/webhooks/cashoffers` with `user.created` | Signature verified |
| 2. Check existing subscription | Skip if user already has active sub | No duplicate trials |
| 3. Create free trial | 90-day trial, SHELL role, HomeUptick enabled | Status: `free_trial` |
| 4. Trial lifecycle begins | Warnings at 10 days, expiration at 90 days | See [Free Trial Lifecycle](#10-free-trial-lifecycle) |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| User already has active subscription | Trial skipped | Create sub first, then fire webhook |
| User already has trial | Trial skipped | Fire webhook twice |

### How to Test

**Dev CLI:**
```bash
yarn dev:tools webhook user.created <user_id>
yarn dev:tools state <user_id>
```

---

## 21. Cron: Trial Expiration Warning

**Process:** Cron sends warning email to trial users approaching expiration.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Cron queries | Find trials with `trial_ends_at` within 10 days | Correct trials found |
| 2. Warning email sent | "Your trial expires in X days" | Email with days remaining |
| 3. No state change | Trial continues as-is | Status still `free_trial` |

### How to Test

**Dev CLI:**
```bash
yarn dev:tools scenario trial-expiring
yarn dev:tools cron-preview
# Should show trial warning entry
yarn dev:tools cron-run <user_id>
```

---

## 22. Cron: Trial Expiration

**Process:** Trial period ends, system attempts conversion to paid.

### Lifecycle

See [Free Trial Lifecycle](#10-free-trial-lifecycle) steps 3-5.

### How to Test

**Dev CLI:**
```bash
yarn dev:tools scenario trial-expired
yarn dev:tools cron-preview
# Should show trial expiration entry
yarn dev:tools cron-run <user_id>
yarn dev:tools state <user_id>
```

---

## 23. Suspension After Max Retries

**Process:** After 4 failed payment attempts, subscription should be suspended.

### Current State

**This is NOT yet automated (TODO-002, DISC-003).** After the 3rd retry fails, no automatic suspension occurs. Suspension must be done manually.

### Expected Lifecycle (Once Implemented)

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. 4th payment failure | Max retries exhausted | Retry count = 4 |
| 2. Auto-suspend | Status → `suspended` | Cron stops attempting |
| 3. User deactivated | `active=0`, `is_premium=0` in main API | User loses access |
| 4. Suspension email | User notified with reactivation instructions | Email sent |
| 5. User config reverted | **Not yet implemented (DISC-006)** | Role/config cleanup |

### How to Test

**Dev CLI (manual simulation):**
```bash
# Create retry scenario
yarn dev:tools scenario payment-retry-2

# Manually suspend
yarn dev:tools set-state <sub_id> status=paused

# Verify cron skips
yarn dev:tools cron-preview
```

---

## 24. Manage Account: Login Flow

**Process:** User logs into the account management portal.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Navigate to `/manage` | Loading step checks existing session | Auto-login if cookie valid |
| 2. Enter email | POST `/api/signup/checkuserexists` | User found → password step; not found → error |
| 3. Enter password | POST `/api/auth/login` | `_api_token` cookie set |
| 4. Dashboard shown | Subscription info, action buttons | Correct plan, dates, amount shown |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| Invalid email | "User not found" error | Enter non-existent email |
| Wrong password | "Invalid credentials" error | Enter wrong password |
| Expired session | Re-login required | Clear cookies, navigate to /manage |
| Deactivated user with premium history | Reactivation email offered | Enter deactivated premium user's email |
| Deep link with goto param | Redirect after login | `/manage?goto=subscription` |

### How to Test

**Frontend:**
1. Navigate to `http://localhost:3000/manage`
2. Enter a test user's email
3. Enter password
4. Verify dashboard loads with correct subscription info

**Deep links:**
- `http://localhost:3000/manage?goto=dashboard`
- `http://localhost:3000/manage?goto=subscription`
- `http://localhost:3000/manage?goto=card`
- `http://localhost:3000/manage?goto=changePlan`

---

## 25. Manage Account: View Subscription

**Process:** Logged-in user views their subscription details.

### Lifecycle

| Step | What Happens | Verify |
|------|-------------|--------|
| 1. Click "Manage Your Subscription" | Fetches subscription via API | GET `/api/manage/getsubscription` |
| 2. Details displayed | Plan name, team size, monthly amount, start date, renewal date, status | All fields correct |
| 3. Actions available | Change Plan, Update Card, Back | Buttons functional |

### How to Test

**Frontend:**
1. Log in at `/manage`
2. Click "Manage Your Subscription"
3. Verify all displayed information matches `yarn dev:tools state <user_id>`

---

## 26. Email Notifications

**Process:** Transactional emails sent at each lifecycle event.

### Email Matrix

| Event | Email Sent | Template |
|-------|-----------|----------|
| New user purchase (provisioned) | Purchase confirmation | subscription-created |
| New user purchase (provisioning failed) | Purchase error notice (NOT welcome) | purchase-error-customer |
| Subscription renewed | Renewal receipt | subscription-renewed |
| Payment failed | Payment failure notice | payment-failed |
| Payment refunded | Refund confirmation | payment-refunded |
| Card updated | Card update confirmation | card-updated |
| Subscription cancelled | Cancellation confirmation | subscription-cancelled |
| Subscription paused | Pause confirmation | subscription-paused |
| Subscription resumed | Resume confirmation | subscription-resumed |
| Trial started | Welcome + trial info | trial-started |
| Trial expiring (10 days) | Trial warning | trial-expiring |
| Trial expired | Trial ended notice | trial-expired |
| Property unlocked | Unlock confirmation | property-unlocked |
| Admin alerts | Error notifications | admin-alert |

### How to Test

**Preview templates:**
```bash
yarn preview:emails
# Open email-previews/index.html in browser
```

**Test email delivery:**
- Set `SEND_EMAILS=true` in `.env.local`
- Set `DEV_EMAIL=your-email@example.com` to redirect all emails to yourself
- Run any scenario that triggers an email

**Verify emails not blocking:**
- Set `SEND_EMAILS=false`
- Run a scenario — verify it completes even though emails are disabled

---

## 27. Authorization & Permissions

**Process:** Every API request (except health/cron/webhooks) requires valid authentication.

### Auth Flows

| Endpoint Type | Auth Method | Verify |
|--------------|-------------|--------|
| Standard API routes | Bearer token (JWT from main API) | 401 without token |
| Cron routes | `CRON_SECRET` header | 401 without secret |
| Webhook routes | HMAC-SHA256 signature | 401 with bad signature |
| Health check | No auth | Always 200 |
| Dev routes | Bearer token (non-production only) | 404 in production |

### Edge Cases

| Case | Expected Behavior | How to Test |
|------|-------------------|-------------|
| Expired token | 401 | Use old token |
| Invalid token | 401 | Use malformed token |
| Non-admin accessing admin route | 403 | Use regular user token on admin endpoint |
| Self-access (allowSelf) | Allowed if token owner = resource owner | Access own subscription |
| Cross-user access | 403 unless admin | Access another user's data |
| Missing CRON_SECRET | 401 on cron endpoints | Call cron without header |

### How to Test

```bash
# No auth
curl http://localhost:3000/api/health

# With valid token
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/subscription/single

# Without auth (should 401)
curl http://localhost:3000/api/subscription/single

# Cron with secret
curl -X POST -H "x-cron-secret: <secret>" http://localhost:3000/api/cron/run
```

---

## 28. Sandbox / Test Mode

**Process:** System detects test scenarios and routes to Square sandbox.

### How It Works

| Signal | Behavior |
|--------|----------|
| `?mock_purchase=true` query param | Skips Square entirely, mock payment |
| Test email pattern (e.g., `*@dev-test.local`) | Routes to sandbox Square environment |
| `SQUARE_ENVIRONMENT=sandbox` config | All charges go to sandbox |
| Dev routes | Available only when `NODE_ENV !== 'production'` |

### How to Test

**Mock purchase (no Square at all):**
1. Navigate to `http://localhost:3000/{whitelabel}/subscribe/{product}?mock_purchase=true`
2. Complete signup — card step should be simplified or skipped
3. Verify subscription created without real charge

**Sandbox mode:**
1. Ensure `SQUARE_ENVIRONMENT=sandbox` in env
2. Use Square sandbox test cards
3. Verify transactions show `square_environment: sandbox`

---

## Known Gaps & TODOs

These items are identified but not yet implemented. Each needs testing once built.

| ID | Gap | Impact | Status |
|----|-----|--------|--------|
| TODO-001 / DISC-001 | Square card update via manage endpoint | Users can't update card via manage route stub | Stub returns error |
| TODO-002 / DISC-003 | Suspension cron (auto-suspend after max retries) | 4th failure doesn't auto-suspend | Manual suspension required |
| TODO-003 / DISC-005 | Upgrade/downgrade user_config update | Plan change doesn't update role/premium in main API | Config stale after switch |
| TODO-004 / DISC-002 | HomeUptick tier-based renewal verification | Tier pricing may not calculate correctly | Needs code review at renew-subscription.use-case.ts:114 |
| DISC-004 | Square webhook handler status | Unclear if Square webhooks are processed | Verify configuration |
| DISC-006 | Suspension user_config revert | Suspended users keep premium config | Config not cleaned up |
| DISC-008 | Permission strings not documented locally | Auth rules reference main API permissions | No local reference |

---

## Testing Checklist Summary

Use this as a go/no-go checklist. Mark each item as you verify it.

### Signup Flows
- [ ] New user paid signup (end-to-end in frontend)
- [ ] New user free signup
- [ ] New user investor signup
- [ ] New user team plan signup
- [ ] Whitelabel signup (at least 2 whitelabels)
- [ ] Duplicate email handling
- [ ] Card decline on signup
- [ ] Mock purchase mode

### Subscription Lifecycle
- [ ] Successful renewal (cron)
- [ ] Payment failure → retry at 1 day
- [ ] Payment failure → retry at 3 days
- [ ] Payment failure → retry at 7 days
- [ ] Cancel on renewal (flag set, cron cancels)
- [ ] Uncancel before renewal
- [ ] Downgrade on renewal
- [ ] Un-downgrade before renewal
- [ ] Pause subscription
- [ ] Resume subscription (verify date recalculation)

### Free Trials
- [ ] Trial creation (via webhook)
- [ ] Trial warning email (10 days before)
- [ ] Trial → paid conversion (success)
- [ ] Trial → inactive (payment failure, no retry)

### Plan Changes
- [ ] Upgrade with proration
- [ ] Role mapping: single → team (AGENT → TEAMOWNER)
- [ ] Role mapping: team → single (TEAMOWNER → AGENT)
- [ ] Role incompatibility blocked (AGENT ↔ INVESTOR)

### Payments & Cards
- [ ] Card update
- [ ] Card update triggers retry during payment failure
- [ ] Refund successful payment
- [ ] Refund already-refunded (blocked)
- [ ] Property unlock ($50)
- [ ] Property unlock auto-refund on failure

### Webhooks
- [ ] user.deactivated → subscriptions paused
- [ ] user.activated → subscriptions resumed
- [ ] user.created → free trial created
- [ ] Invalid signature → rejected

### HomeUptick
- [ ] Addon renewal with main subscription
- [ ] HomeUptick API unavailable → main still renews
- [ ] Tier-based pricing calculation

### Emails
- [ ] All email templates render (preview:emails)
- [ ] DEV_EMAIL redirect works
- [ ] SEND_EMAILS=false doesn't block operations

### Auth & Security
- [ ] Unauthenticated requests → 401
- [ ] Non-admin cross-user access → 403
- [ ] Self-access allowed
- [ ] Cron secret required
- [ ] Webhook signature verified
- [ ] Dev routes hidden in production

### Sandbox/Test Mode
- [ ] Mock purchase mode works
- [ ] Sandbox Square charges work
- [ ] Test email routing to sandbox
