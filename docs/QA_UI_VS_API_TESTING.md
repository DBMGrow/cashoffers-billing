# Pre-Launch QA: UI vs API Testing Breakdown

This document translates the [PRE_LAUNCH_QA_CHECKLIST.md](PRE_LAUNCH_QA_CHECKLIST.md) into:

- **UI-Testable** items — steps to test via the Next.js frontend app
- **API-Only** items — require direct API calls, DB inspection, or log review

Flow references link to [USER_FLOWS.md](USER_FLOWS.md).

---

## Section 1 — Authentication & Authorization

### API-Only

- [x] Token from header (`x-api-token`) resolves valid user
- [x] Missing/invalid token returns 401
- [x] User not found returns 404
- [x] Insufficient permissions returns 403
- [x] Token owner vs. target user distinction
- `paymentContext` attached to all route contexts

### UI-Testable

- [x] **Token from cookie** (`_api_token`) — verified automatically after any signup/login flow
  1. Complete any signup or login flow
  2. Open DevTools → Application → Cookies
  3. Verify `_api_token` cookie is present and non-empty

---

## Section 2 — Purchase Flow: New User (`POST /purchase/new`)

### UI-Testable (Flow 1 — Standard Paid Signup)

**Happy path:**

1. Go to `/subscribe?product={productID}&w={whitelabel}`
2. Enter a **new email** → verify it passes email check
3. Complete Name → Slug → Brokerage → Phone → Card steps
4. Check consent boxes and submit
5. After success:
   - Verify `_api_token` cookie is set (DevTools → Application → Cookies)
   - Verify network response contains `subscription`, `product`, `user`, `userCard`, `userCreated: true` (DevTools → Network → XHR)
   - Verify welcome screen appears and redirect to dashboard occurs

**For mock/sandbox testing:** Use `?mock_purchase=true` to avoid real charges.

- [ ] Valid purchase with new email creates user, card, subscription, transaction
- [ ] Cookie `_api_token` is set on response
- [ ] Response contains `subscription`, `product`, `user`, `userCard`, `userCreated: true`
- [ ] `mock_purchase: true` forces test mode — add `?mock_purchase=true` to URL
- [ ] Whitelabel correctly mapped — test with `?w=yhs`, `?w=kw`, etc.
- [ ] `isInvestor` flag — test Flow 4 with `?product=11`
- [ ] Coupon field — test with `?coupon=CPStart` for Platinum whitelabel
- [ ] Duplicate email returns error — enter existing email, verify "Email already in use" screen (Flow 20)
- [ ] Invalid card token returns error — enter bad card details, verify card error step appears and no success (Flow 30)

### API-Only

- Card created before user (internal ordering — verify via DB/logs)
- Payment charged before user creation; rollback if user creation fails
- Rollback: user "abandoned" (email scrambled, `active=false`) if subscription fails
- `PurchaseRequest` lifecycle states (`PENDING → VALIDATING → PROCESSING_PAYMENT → CREATING_SUBSCRIPTION → FINALIZING → COMPLETED`)
- `PurchaseRequest` marked `FAILED` on any error path

---

## Section 3 — Purchase Flow: Existing User (`POST /purchase/existing`)

### UI-Testable (Flows 16–18 — Plan Change in Manage)

1. Go to `/manage?t={valid_jwt_token}`
2. Complete token check (Flow 13), arrive at Dashboard
3. Click "Manage Your Subscription" → click "Change Plan"
4. Select a new plan → complete confirm plan change steps (Flow 16)
5. Verify:
   - Prorated charge displays correctly in Review step
   - Network response contains `subscription`, `product`, `user`, `userCard`, `userCreated: false`

- [ ] Requires valid session auth — verify redirect to email entry if no token/cookie
- [ ] Purchase with existing card (plan change uses card on file, no new card entry)
- [ ] Response contains `subscription`, `product`, `userCreated: false`
- [ ] `proratedCharge` calculated correctly — visible in Review step of Flow 16
- [ ] `mock_purchase: true` — add `?mock_purchase=true` to manage URL

### API-Only

- User identity from session token (not request body)
- Purchase with new card token updates card on file (no dedicated UI for this)
- Coupon field
- Error response structure (400 vs 500)

---

## Section 4 — Subscription Management

### UI-Testable

**`GET /subscription/single` — Own subscription (Flow 15):**

1. `/manage?t={jwt}` → Dashboard → "Manage Your Subscription"
2. Verify plan name, amount, renewal date, status display correctly
3. Test with a user who has no subscription — verify empty/404 handling

**`POST /subscription/cancel` — Cancel:**

1. If a Cancel button exists in manage UI, click it
2. Verify `cancel_on_renewal: true` is set (check network response or DB)
3. Unauthorized user accessing another user's subscription → verify 403

### API-Only (admin endpoints — no UI)

- `GET /subscription/` — paginated admin list (requires `payments_read_all`)
- `POST /subscription/` — create or update subscription
- `PUT /subscription/` — update fields
- `DELETE /subscription/` — deactivate by `user_id`
- `PATCH /subscription/pause/:id` — pause + sends pause email
- `PATCH /subscription/resume/:id` — resume + sends email
- `DELETE /subscription/cancel/:id` — uncancel (`cancel_on_renewal` cleared)
- `POST /subscription/downgrade/:id` — set `downgrade_on_renewal` flag
- `DELETE /subscription/downgrade/:id` — clear `downgrade_on_renewal` flag

---

## Section 5 — Subscription Renewal Cron

### API-Only (all items)

All items require direct API calls with `CRON_SECRET`. Test via:

```bash
curl -X POST /cron/run -d '{"secret": "..."}'
```

- [ ] Wrong secret returns error; correct secret runs cron
- [ ] Finds subscriptions due for renewal
- [ ] Inactive users (`active: 0`) skipped
- [ ] Users with no email skipped with warning
- [ ] `cancel_on_renewal: true` → cancelled, not charged
- [ ] `downgrade_on_renewal: true` → skipped (confirm expected behavior — see Section 22)
- [ ] Successful renewal → updates `renewal_date`, logs transaction, publishes events
- [ ] Failed renewal → retry logic: 1 day → 3 days → 7 days
- [ ] Failed renewal → `PaymentFailedEvent` published → failure email sent
- [ ] Failed renewal → failed transaction logged to DB
- [ ] Cron fatal error → admin notification email sent
- [ ] Cron fatal error → failed transaction logged with `user_id: 0`
- [ ] Correct Square environment used (sandbox card → sandbox Square)

---

## Section 6 — Health Report

### API-Only

```bash
curl -X POST /cron/healthreport -d '{"secret": "..."}'
```

- [ ] Secret validation works
- [ ] Sends daily health report to `DEV_EMAIL`
- [ ] Also sends to `ADMIN_EMAIL` if different from `DEV_EMAIL`
- [ ] Accepts optional `date` param for specific date report
- [ ] Error if no email recipients configured

---

## Section 7 — Card Management

### UI-Testable

**`POST /card/` — Update card (Flow 14):**

1. `/manage?t={jwt}` → Dashboard → "Update Your Billing Info"
2. Enter new card details in Square form
3. Submit → verify "Card Updated" success screen
4. Check inbox for card-updated email (`sendEmailOnUpdate`)

- [ ] Creates new card in Square via card token
- [ ] `sendEmailOnUpdate: true` → card-updated email received
- [ ] ⚠️ `POST /manage/updatecard` is currently a **stub** — see Section 22

### API-Only

- `GET /card/:user_id/info` — returns whether user has card on file
- `GET /card/:user_id` — returns full card record
- `attemptRenewal: true` behavior (no UI trigger)
- Uses correct Square environment based on `paymentContext`

---

## Section 8 — Payment Management

### API-Only (all items — admin/internal endpoints)

- [ ] `GET /payment/:user_id` — with/without `all=true` and `payments_read_all` capability; pagination
- [ ] `POST /payment/` — charges user card, sends confirmation email, logs transaction
- [ ] `POST /payment/refund` — refunds Square transaction, sends refund email, logs refund

---

## Section 9 — Product Management

### UI-Testable (indirectly)

- Products display correctly in subscribe and manage flows
- Verify correct products appear per whitelabel and role (validated by running UI flows per Section 20)

### API-Only (direct endpoint testing)

- [ ] `GET /product/:id` — returns product or error if not found
- [ ] `GET /product/` — returns all products
- [ ] `POST /product/` — creates product; validates `user_config` schema
- [ ] `POST /product/checkprorated` — drives prorated charge shown in UI (test indirectly via Flow 16)

---

## Section 10 — Signup Flow

### UI-Testable

**`POST /signup/purchasefree` (Flow 2):**

1. `/subscribe?product=free`
2. Enter new email → Name → Phone → Brokerage → Review (no card step)
3. Submit → verify welcome screen, `_api_token` cookie set, dashboard redirect
4. Test `isInvestor` path via Flow 5: `/subscribe?product=freeinvestor`
5. Test duplicate email → verify coded error

- [ ] Creates new user without paid subscription
- [ ] `isInvestor: true` → role = `INVITEDINVESTOR`, otherwise `AGENT`
- [ ] Whitelabel correctly mapped from code to ID
- [ ] Sets `_api_token` cookie on response
- [ ] Handles duplicate email gracefully
- [ ] Returns `warning` success for edge cases

**`GET /signup/checkuserexists/:email` (triggered in email step of all subscribe flows):**

1. Enter **existing email** → verify "Email already in use" (Flow 20)
2. Enter **existing premium+inactive email** on free plan → verify "Offer Downgrade" (Flow 21)
3. Enter email with card → verify `hasCard: true` response path (check network)
4. Enter email without card → verify `canSetUpCard` response path
5. Verify plan tier from `max_users` in network response:
   - ≤6 → plan 2, ≤10 → plan 3, ≤15 → plan 4, ≤20 → plan 5, ≤50 → plan 6, ≤75 → plan 7, ≤100 → plan 8, >100 → plan 9

**`GET /signup/checkslugexists/:slug` (triggered in slug step):**

1. In slug step, enter a **taken** slug → verify "Domain Prefix already in use" error (Flow 31)
2. Enter **available** slug → verify flow continues

**`POST /signup/sendreactivation` (Flow 21):**

1. Enter inactive premium user email on free plan
2. Confirm reactivation offer → verify "Email Sent" confirmation screen
3. Check inbox for reactivation email with token URL

- [ ] Requires user to be `is_premium: true` AND `active: false`
- [ ] Sends reactivation email
- [ ] Returns error if user not found or ineligible

**`GET /signup/products` (all subscribe flows):**

1. Load subscribe page with each `?w=` param; verify correct products appear
2. Verify products without `whitelabel_id` appear for all whitelabels

**`GET /signup/whitelabels` (all subscribe flows):**

1. Load each whitelabel; verify correct branding (logo, colors)
2. Verify fallback to defaults when `data` not set

**`GET /signup/getuniqueslug`:**

1. In slug step, verify auto-generated slug appears based on name
2. If slug already taken, verify suffix is appended (e.g., `john-smith-1`)

---

## Section 11 — Manage Routes

### UI-Testable

**`GET /manage/checktoken/:token` (Flow 13):**

1. `/manage?t={valid_jwt}` → verify dashboard loads with user data
2. Verify `_api_token` cookie set after validation
3. Use expired/invalid token → verify redirect to email entry (Flow 34)

- [ ] Verifies JWT with correct secret
- [ ] Sets `_api_token` cookie
- [ ] Returns user data
- [ ] Invalid/expired token returns error → redirects to email step

**`GET /manage/products` (Flow 16):**

1. In plan change flow, verify only role-compatible products shown:
   - AGENT/TEAMOWNER user → investor products must **not** appear
   - INVESTOR user → agent products must **not** appear
2. Verify only products matching user's `whitelabel_id` appear

**`GET /manage/whitelabels`:**

1. Load manage flow; verify branding loads correctly per user's whitelabel

**`GET /manage/subscription/single` (Flow 15):**

1. Dashboard → "Manage Your Subscription"
2. Verify: plan name, team size (if applicable), amount, start date, renewal date, status
3. Test with user who has no active subscription → verify 404 handling

**`POST /manage/checkplan` (Flows 16–18):**

1. Select new plan → verify plan check response in network tab
2. Team plan with too many users → verify "Reduce Max Users" error screen (Flow 18)
3. AGENT attempting to switch to INVESTOR plan → verify `ROLE_INCOMPATIBLE` error
4. Verify prorated cost appears in "Confirm Plan Changes" step

**`POST /manage/purchase` (Flow 16):**

1. Complete full plan change flow
2. Verify prorated charge matches expected amount
3. Verify "Plan Changed" success screen
4. Verify updated subscription details in network response
5. Test with `?mock_purchase=true` to avoid real charge
6. Test with $0 prorated amount → verify no charge occurs

**`POST /manage/updatecard` (Flow 14) — ⚠️ STUB:**

1. Dashboard → "Update Your Billing Info"
2. Enter new card → submit
3. **Note:** Currently a stub — logs but does not implement Square card update. Confirm if blocking before go-live.

---

## Section 12 — Auth Routes

### UI-Testable

**`POST /auth/login` (Flow 22):**

1. `/manage` (no token) → enter existing email → enter password
2. Correct credentials → verify dashboard loads, `_api_token` cookie set
3. Wrong password → verify "Incorrect Password" screen (Flow 33)
4. Verify `_api_token` cookie cleared after logout (if logout button present)

- [ ] Proxies login to V2 auth API
- [ ] Sets `_api_token` cookie from V2 response
- [ ] Returns user data on success
- [ ] Returns error on failed credentials

**`POST /auth/logout`:**

1. If logout button present in manage UI: click it
2. Verify `_api_token` cookie is cleared (DevTools → Application → Cookies)

### API-Only

- `GET /auth/check` — returns authenticated user data (no UI trigger)

---

## Section 13 — Property Unlock

### API-Only (no UI in this app)

```bash
POST /property/:property_token
```

- [ ] Requires `properties_unlock` permission
- [ ] Charges $50 via Square
- [ ] Returns property address, transaction ID, Square payment ID, amount, unlock status

---

## Section 14 — Email Templates

All emails triggered by UI flows should be verified by checking the recipient inbox.

| Email                         | How to trigger via UI                  | Notes                        |
| ----------------------------- | -------------------------------------- | ---------------------------- |
| `subscription-created`        | Complete any paid signup (Flow 1)      |                              |
| `subscription-renewal`        | Run renewal cron (API only)            |                              |
| `subscription-renewal-failed` | Run cron with bad card (API only)      |                              |
| `subscription-cancelled`      | Cancel subscription via manage UI      |                              |
| `subscription-paused`         | API only (`PATCH /subscription/pause`) |                              |
| `subscription-plan-updated`   | Complete plan change (Flow 16)         |                              |
| `subscription-downgraded`     | API only                               |                              |
| `subscription-suspended`      | API only                               |                              |
| `payment-confirmation`        | Any successful payment                 |                              |
| `payment-error`               | Any failed payment                     |                              |
| `refund`                      | API only (`POST /payment/refund`)      |                              |
| `card-updated`                | Complete Flow 14 (update card)         | Stub caveat — see Section 22 |
| `account-reactivation`        | Complete Flow 21 (send reactivation)   |                              |
| `daily-health-report`         | API only (`POST /cron/healthreport`)   |                              |

**Sandbox banner:**

- Use `?mock_purchase=true` in any UI flow
- Verify sandbox banner renders in all received emails

---

## Section 15 — Event System

### API-Only (verify via logs/DB)

- [ ] `UserCreatedEvent` published on new user purchase
- [ ] `SubscriptionCreatedEvent` published on new subscription
- [ ] `SubscriptionRenewedEvent` published on successful renewal
- [ ] `PaymentProcessedEvent` published on any successful payment
- [ ] `PaymentFailedEvent` published on renewal failure → triggers failure email
- [ ] Event handlers do not block the main request flow

---

## Section 16 — Transaction Logging

### API-Only (verify via DB query or admin endpoint)

- [ ] Every successful payment logs a `completed` transaction
- [ ] Every failed payment logs a `failed` transaction
- [ ] Refunds are logged
- [ ] Renewals log correct `square_environment` (`production` vs `sandbox`)
- [ ] Cron errors log a `failed` transaction with `user_id: 0`

---

## Section 17 — Test Mode / Sandbox

### UI-Testable

- [ ] `mock_purchase: true` in body — add `?mock_purchase=true` to any subscribe/manage URL
- [ ] Sandbox payments go to Square Sandbox — complete a mock purchase and verify in Square Sandbox dashboard
- [ ] Sandbox banner in emails — complete a mock purchase and check email

**Steps to test mock purchase:**

1. `/subscribe?product={id}&mock_purchase=true`
2. Complete full signup flow
3. Verify no real charge in Square Production dashboard
4. Verify charge appears in Square Sandbox dashboard
5. Check email for sandbox banner

### API-Only

- `square_environment` stored on cards and subscriptions (verify via DB)
- Renewal cron correctly routes sandbox vs production cards

---

## Section 18 — Prorated Charge Calculation

### UI-Testable (Flow 16)

1. Log in as premium user with an active monthly subscription
2. Go to "Change Plan" → select a **higher-priced** plan
3. Verify prorated amount displays in "Confirm Plan Changes" step
4. Manually verify: `(days_remaining / days_in_period) × (new_price - old_price)`
5. Select same-priced or lower-priced plan → verify $0 prorated charge shown

- [ ] Correctly calculates days remaining in billing period
- [ ] Returns $0 if user has no existing subscription
- [ ] Returns $0 if new product costs same or less
- [ ] Returns correct partial-period amount for upgrades
- [ ] Test with `monthly` duration (most common case)

---

## Section 19 — Role Mapping (Plan Type Transitions)

### UI-Testable (via Flow 16 — Plan Change)

1. Log in as **AGENT** on a single-user plan → change to a **team plan** → verify role becomes `TEAMOWNER` (check network response)
2. Log in as **TEAMOWNER** on team plan → change to a **single-user plan** → verify role becomes `AGENT`
3. Log in as **AGENT** → open plan change → verify INVESTOR products do **not** appear in the list
4. Log in as **INVESTOR** → open plan change → verify AGENT/TEAMOWNER products do **not** appear

- [ ] Single plan → Team plan: user role becomes `TEAMOWNER`
- [ ] Team plan → Single plan: user role becomes `AGENT`
- [ ] Same plan type: uses product's configured role

---

## Section 20 — Whitelabel Support

### UI-Testable

Test each whitelabel by visiting the subscribe page with the corresponding `?w=` parameter:

| Whitelabel      | URL Parameter        | Expected ID |
| --------------- | -------------------- | ----------- |
| Default         | `?w=default` or none | 1           |
| Keller Williams | `?w=kw`              | 2           |
| YHS             | `?w=yhs`             | 3           |
| IOP             | `?w=iop`             | 4           |
| UCO             | `?w=uco`             | 5           |
| MOP             | `?w=mop`             | 6           |
| ECO             | `?w=eco`             | 7           |

**For each whitelabel:**

1. Load `/subscribe?product={id}&w={code}` and verify:
   - Correct logo renders
   - Correct brand colors apply
   - Only whitelabel-specific products appear
2. Test manage flow: `/manage?t={jwt}` for a user with that `whitelabel_id` — verify same branding
3. Verify fallback to defaults when whitelabel `data` is not configured

- [ ] Products filtered correctly by `whitelabel_id` in signup and manage routes
- [ ] Whitelabel branding falls back to defaults if not configured
- [ ] Whitelabel code → ID mapping is correct

---

## Section 21 — Infrastructure & Middleware

### API-Only (verify via logs/monitoring)

- [ ] Error handler middleware catches unhandled errors and returns structured response
- [ ] Logging context middleware attaches request ID to all log entries
- [ ] Logging flush middleware flushes log buffer at end of request
- [ ] Digest middleware functions correctly
- [ ] BigInt serialization — BigInt values from DB serialize to strings (not `[object Object]`)
- [ ] DB connection — Kysely connects successfully to MySQL
- [ ] `@api/` module alias resolves correctly in all environments

---

## Section 22 — Known TODOs to Confirm Before Go-Live

| Item                                                                       | Where to Test                                | Status                              |
| -------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------- |
| `POST /manage/updatecard` is a stub — no Square card update implemented    | Flow 14 — "Update Billing Info" in manage UI | ⚠️ Confirm if blocking              |
| `suspendSubscriptionsCron` commented out in cron route                     | API only                                     | Confirm if suspension flow required |
| `downgrade_on_renewal` — cron skips but does not process downgrade         | API only                                     | Confirm expected behavior           |
| HomeUptick addon subscription — `TODO` in `renew-subscription.use-case.ts` | API only                                     | Confirm if active subscribers exist |
| `GET /product/` — missing filter/sort support                              | API only                                     | Confirm if filtering needed         |

---

## Section 23 — Environment Variables

### DevOps/API-Only

Verify all required env vars are set in the production environment:

- [ ] `SQUARE_ACCESS_TOKEN` + `SQUARE_ENVIRONMENT`
- [ ] `API_URL`, `API_URL_V2`, `API_MASTER_TOKEN`, `API_KEY`
- [ ] `JWT_SECRET`
- [ ] `CRON_SECRET`
- [ ] `ADMIN_EMAIL`, `DEV_EMAIL`
- [ ] `SENDGRID_API_KEY` (or SMTP config for dev)
- [ ] `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- [ ] `APP_URL`
- [ ] `HOMEUPTICK_URL` (optional — confirm if needed)

---

## Summary

| Checklist Section         | UI-Testable                   | API-Only                    |
| ------------------------- | ----------------------------- | --------------------------- |
| 1. Auth & Authorization   | Partial (cookie verification) | Mostly                      |
| 2. New User Purchase      | Mostly                        | Internal ordering, rollback |
| 3. Existing User Purchase | Mostly                        | Session token handling      |
| 4. Subscription CRUD      | Partial (own sub, cancel)     | All admin endpoints         |
| 5. Renewal Cron           | None                          | All                         |
| 6. Health Report          | None                          | All                         |
| 7. Card Management        | Update card flow              | GET endpoints               |
| 8. Payment Management     | None                          | All                         |
| 9. Product Management     | Indirect (display)            | Direct CRUD                 |
| 10. Signup Flow           | Fully                         | None                        |
| 11. Manage Routes         | Fully                         | None                        |
| 12. Auth Routes           | Login/logout                  | Check endpoint              |
| 13. Property Unlock       | None                          | All                         |
| 14. Email Templates       | Triggered by UI flows         | Cron, refund emails         |
| 15. Event System          | None                          | All                         |
| 16. Transaction Logging   | None                          | All                         |
| 17. Test Mode             | Partial (`mock_purchase`)     | Header-based, DB            |
| 18. Prorated Charges      | Fully (Flow 16)               | None                        |
| 19. Role Mapping          | Fully (plan change)           | None                        |
| 20. Whitelabel Support    | Fully (URL params)            | None                        |
| 21. Infrastructure        | None                          | All                         |
| 22. Known TODOs           | Flow 14 (stub)                | Rest are API/DB             |
| 23. Environment Variables | None                          | All (DevOps)                |
