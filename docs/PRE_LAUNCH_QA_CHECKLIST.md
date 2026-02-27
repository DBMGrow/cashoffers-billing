# CashOffers Billing — Pre-Launch QA Checklist

---

## 1. Authentication & Authorization

- [ ] **Token from header** (`x-api-token`) resolves a valid user from the DB
- [ ] **Token from cookie** (`_api_token`) resolves a valid user from the DB
- [ ] **Missing token** returns `401 Unauthorized`
- [ ] **Invalid token** returns `401 Unauthorized`
- [ ] **User not found for token** returns `404`
- [ ] **Insufficient permissions** returns `403` (e.g., non-admin calling `payments_read_all`)
- [ ] **Token owner vs. target user** distinction works correctly (admin acting on behalf of another user)
- [ ] **Test mode** (`testMode: true`) is correctly detected and only authorized for users with `payments_sandbox` capability
- [ ] **Test mode** attempted by unauthorized user returns `403`
- [ ] `paymentContext` is correctly attached to all authenticated route contexts

---

## 2. Purchase Flow — New User (`POST /purchase/new`)

- [ ] Valid purchase with new email creates user, card, subscription, transaction
- [ ] **Cookie is set** on response (`_api_token`) for the newly created user
- [ ] Response contains `subscription`, `product`, `user`, `userCard`, `userCreated: true`
- [ ] **Card created first** (user_id = null), then user created, then card bound to user
- [ ] **Payment charged before user creation** — if user creation fails, payment is refunded
- [ ] **Rollback**: if anything fails after payment → payment is refunded via Square
- [ ] **Rollback**: if anything fails after user creation → user is "abandoned" (email scrambled, active=false)
- [ ] `mock_purchase: true` forces `testMode: true` for sandbox payments
- [ ] Whitelabel is correctly mapped from `whitelabel` field to `whitelabel_id`
- [ ] `isInvestor` flag is correctly passed through
- [ ] `coupon` field is accepted (validate if coupon logic is implemented)
- [ ] **Duplicate email** (existing user) returns appropriate error
- [ ] **Invalid card token** returns error and no user or subscription is created
- [ ] PurchaseRequest lifecycle: `PENDING → VALIDATING → PROCESSING_PAYMENT → CREATING_SUBSCRIPTION → FINALIZING → COMPLETED`
- [ ] PurchaseRequest marked `FAILED` on any error path

---

## 3. Purchase Flow — Existing User (`POST /purchase/existing`)

- [ ] Requires valid session auth (`x-api-token` header or `_api_token` cookie)
- [ ] User identity comes from session token (not request body)
- [ ] Purchase with existing card (no card token provided) uses card on file
- [ ] Purchase with new card token updates card on file
- [ ] Response contains `subscription`, `product`, `user`, `userCard`, `userCreated: false`
- [ ] `proratedCharge` is calculated correctly if user already has a subscription
- [ ] `mock_purchase: true` forces `testMode: true`
- [ ] **Coupon** field accepted
- [ ] Error responses correctly structured (400 for use-case failures, 500 for unexpected errors)

---

## 4. Subscription Management

### GET /subscription/ (admin — paginated list)
- [ ] Requires `payments_read_all` permission
- [ ] Pagination works (`page`, `limit` params)
- [ ] Returns all subscriptions

### GET /subscription/single (own subscription)
- [ ] No special permission required (session only)
- [ ] Returns the authenticated user's subscription
- [ ] Returns empty/404 if user has no subscription

### POST /subscription/ (create or update)
- [ ] Requires `payments_create`
- [ ] If subscription exists → updates fields (`subscription_name`, `amount`, `duration`)
- [ ] If no subscription → creates new subscription
- [ ] `signup_fee: 0` waives signup fee

### PUT /subscription/ (update fields)
- [ ] Requires `payments_create`
- [ ] Updates `subscription_id`, `subscription_name`, `amount`, `duration`, `status`

### DELETE /subscription/ (deactivate)
- [ ] Requires `payments_delete`
- [ ] Deactivates subscription by `user_id`

### PATCH /subscription/pause/:subscription_id
- [ ] Requires `payments_create`
- [ ] Sets subscription to paused state
- [ ] Sends pause email

### PATCH /subscription/resume/:subscription_id
- [ ] Requires `payments_create`
- [ ] Resumes a paused subscription
- [ ] Sends resume/reactivation email

### POST /subscription/cancel/:subscription_id
- [ ] Self-service: user can cancel their own subscription
- [ ] Admin can cancel any subscription
- [ ] Sets `cancel_on_renewal: true`
- [ ] Unauthorized user returns 403

### DELETE /subscription/cancel/:subscription_id (uncancel)
- [ ] Clears `cancel_on_renewal` flag
- [ ] Subscription auth check works correctly

### POST /subscription/downgrade/:subscription_id
- [ ] Sets `downgrade_on_renewal: true`
- [ ] Subscription auth check works correctly

### DELETE /subscription/downgrade/:subscription_id (undowngrade)
- [ ] Clears `downgrade_on_renewal` flag

---

## 5. Subscription Renewal Cron (`POST /cron/run`)

- [ ] **Secret validation** — wrong secret returns error, correct secret runs cron
- [ ] Finds all subscriptions due for renewal (`findSubscriptionsForCronProcessing`)
- [ ] Fetches all users from main API (`/users/mini`)
- [ ] **Inactive users** (`active: 0`) are skipped
- [ ] **Users with no email** are skipped with a warning
- [ ] **`cancel_on_renewal: true`** → subscription is cancelled (not charged), not renewed
- [ ] **`downgrade_on_renewal: true`** → skipped (not yet fully implemented — confirm expected behavior)
- [ ] Successful renewal → updates `renewal_date`, logs transaction, publishes events
- [ ] Failed renewal → retry logic applies:
  - First failure: retry in **1 day**
  - Second failure: retry in **3 days**
  - Subsequent failures: retry in **7 days**
- [ ] Failed renewal → `PaymentFailedEvent` published → failure email sent to user
- [ ] Failed renewal → failed transaction logged to DB
- [ ] Cron fatal error → admin notification email sent
- [ ] Cron fatal error → failed transaction logged (`user_id: 0`)
- [ ] Payment uses correct Square environment (sandbox card → sandbox Square, production card → production Square)

---

## 6. Health Report (`POST /cron/healthreport`)

- [ ] **Secret validation** works
- [ ] Sends daily health report to `DEV_EMAIL`
- [ ] Also sends to `ADMIN_EMAIL` if different from `DEV_EMAIL`
- [ ] Accepts optional `date` param to generate report for a specific date
- [ ] Error if no email recipients configured

---

## 7. Card Management

### GET /card/:user_id/info
- [ ] Requires session auth (no specific permissions)
- [ ] Returns whether user has a card on file

### GET /card/:user_id
- [ ] Returns full card record for user

### POST /card/
- [ ] Creates new card in Square (via card token)
- [ ] Stores card in `UserCards` table
- [ ] `sendEmailOnUpdate: true` → sends card-updated email
- [ ] `attemptRenewal: true` → attempts renewal if subscription had a failed payment
- [ ] Uses correct Square environment based on `paymentContext`

---

## 8. Payment Management

### GET /payment/:user_id
- [ ] Requires `payments_read`
- [ ] With `all=true` and `payments_read_all` capability → returns all payments
- [ ] Without `all=true` → returns only the specified user's payments
- [ ] Pagination works (`page`, `limit`)

### POST /payment/
- [ ] Requires `payments_create`
- [ ] Creates charge against user's card on file
- [ ] Sends payment confirmation email (`sendEmailOnCharge: true`)
- [ ] Logs transaction to DB
- [ ] Uses `paymentContext` for correct Square environment

### POST /payment/refund
- [ ] Requires `payments_create`
- [ ] Refunds a Square transaction by `transaction_id`
- [ ] Sends refund email
- [ ] Logs refund transaction to DB

---

## 9. Product Management

### GET /product/:product_id
- [ ] Requires `payments_read`
- [ ] Returns product by ID
- [ ] Returns error if product not found

### GET /product/
- [ ] Requires `payments_read`
- [ ] Returns all products

### POST /product/
- [ ] Requires `payments_create`
- [ ] Creates product with `product_name`, `product_description`, `product_type`, `price`, `data`
- [ ] `data.user_config` validated against schema (role, is_premium, white_label_id, is_team_plan)

### POST /product/checkprorated
- [ ] Requires `payments_create`
- [ ] Calculates prorated cost for plan upgrade/downgrade
- [ ] Returns correct amount based on time remaining in billing period
- [ ] Error if user has no subscription or product not found

---

## 10. Signup Flow

### POST /signup/purchasefree
- [ ] Creates new user in auth API without a paid subscription
- [ ] `isInvestor: true` → role = `INVITEDINVESTOR`, otherwise `AGENT`
- [ ] Whitelabel correctly mapped from code to ID
- [ ] Sets `_api_token` cookie on response
- [ ] Handles duplicate email gracefully (returns coded error)
- [ ] Returns `warning` success for edge cases

### GET /signup/checkuserexists/:email
- [ ] Returns `{ userExists: false }` for unknown email
- [ ] Returns `{ userExists: true, offerDowngrade: true }` for premium but inactive user
- [ ] Returns `{ userExists: true, hasCard: true }` for user with card
- [ ] Returns `{ userExists: true, canSetUpCard: true, plan: N }` for user without card
- [ ] Plan tier correctly determined from team `max_users`:
  - ≤6 → plan 2, ≤10 → plan 3, ≤15 → plan 4, ≤20 → plan 5, ≤50 → plan 6, ≤75 → plan 7, ≤100 → plan 8, >100 → plan 9

### GET /signup/checkslugexists/:slug
- [ ] Returns `{ userExists: false }` if slug is available
- [ ] Returns `{ userExists: true }` if slug is taken
- [ ] Proxies to V2 auth API correctly

### POST /signup/sendreactivation
- [ ] Requires user to be `is_premium: true` AND `active: false`
- [ ] Sends reactivation email with token URL
- [ ] Returns error if user not found
- [ ] Returns error if user is not eligible (active or not premium)

### GET /signup/products
- [ ] Returns products filtered by `whitelabel` query param
- [ ] Products without `whitelabel_id` included for all whitelabels (backward compat)

### GET /signup/whitelabels
- [ ] Returns all whitelabels with branding data
- [ ] Falls back to default colors/logo if `data` not set

### GET /signup/getuniqueslug
- [ ] Generates unique slug from `name` query param
- [ ] Appends suffix if slug already taken

---

## 11. Manage Routes (Self-Service Portal)

### POST /manage/checkplan
- [ ] Fetches user and validates role compatibility with new product
- [ ] AGENT/TEAMOWNER → cannot switch to INVESTOR product (returns `ROLE_INCOMPATIBLE`)
- [ ] INVESTOR → cannot switch to AGENT/TEAMOWNER product
- [ ] Fetches team details for team subscriptions
- [ ] Fetches team users list and count
- [ ] Calculates prorated cost for the plan switch
- [ ] Returns full context: `product`, `proratedCost`, `team`, `teamUsers`, `numberOfUsers`

### GET /manage/checktoken/:token
- [ ] Verifies JWT token with correct secret
- [ ] Fetches user from main API
- [ ] Sets `_api_token` cookie on response
- [ ] Returns user data
- [ ] Invalid/expired token returns error

### GET /manage/products
- [ ] Requires session auth
- [ ] Filters products by user's role compatibility (AGENT/TEAMOWNER vs INVESTOR)
- [ ] Filters products by user's `whitelabel_id`
- [ ] Products without role or whitelabel are included (backward compat)

### GET /manage/whitelabels
- [ ] Requires session auth
- [ ] Returns all whitelabels with branding data

### GET /manage/subscription/single
- [ ] Requires session auth
- [ ] Returns user's active subscription with product details (JOIN)
- [ ] Returns 404 if no active subscription

### POST /manage/updatecard
- [ ] Requires session auth
- [ ] ⚠️ **TODO stub** — currently logs but does not implement Square card update. **Confirm if this is blocking before go-live.**

### POST /manage/purchase (plan change)
- [ ] Requires session auth
- [ ] Validates role compatibility of new product
- [ ] Requires `subscription_id` in body
- [ ] Calculates prorated charge
- [ ] Charges prorated amount if > 0 (sends payment email)
- [ ] Updates subscription to new `product_id`, `subscription_name`, `amount`, `duration`
- [ ] Returns updated subscription and charge details
- [ ] No charge if prorated amount is 0

---

## 12. Auth Routes

### POST /auth/login
- [ ] Proxies login to V2 auth API
- [ ] Sets `_api_token` cookie from V2 response
- [ ] Returns user data on success
- [ ] Returns error on failed credentials

### GET /auth/check
- [ ] Requires session auth
- [ ] Returns authenticated user data

### POST /auth/logout
- [ ] Clears `_api_token` cookie
- [ ] Returns success

---

## 13. Property Unlock (`POST /property/:property_token`)

- [ ] Requires `properties_unlock` permission
- [ ] Charges $50 via Square using provided card token
- [ ] Returns property address, transaction ID, Square payment ID, amount, unlock status
- [ ] Uses `paymentContext` for correct Square environment

---

## 14. Email Templates (React Email)

All emails should render correctly and send to the right recipients:

- [ ] **`subscription-created`** — on new subscription purchase
- [ ] **`subscription-renewal`** — on successful renewal
- [ ] **`subscription-renewal-failed`** — on renewal payment failure (with next retry date)
- [ ] **`subscription-cancelled`** — when subscription is cancelled
- [ ] **`subscription-paused`** — when subscription is paused
- [ ] **`subscription-plan-updated`** — when plan is changed
- [ ] **`subscription-downgraded`** — when subscription is downgraded
- [ ] **`subscription-suspended`** — when subscription is suspended
- [ ] **`payment-confirmation`** — on any successful payment
- [ ] **`payment-error`** — on payment failure (admin)
- [ ] **`refund`** — on successful refund
- [ ] **`card-updated`** — when card on file is updated
- [ ] **`account-reactivation`** — reactivation link email for inactive premium users
- [ ] **`daily-health-report`** — system health metrics email
- [ ] **Sandbox banner** renders on all emails when in test mode

---

## 15. Event System

Verify events are published and handled correctly:

- [ ] **`UserCreatedEvent`** — published on new user purchase
- [ ] **`SubscriptionCreatedEvent`** — published on new subscription
- [ ] **`SubscriptionRenewedEvent`** — published on successful renewal
- [ ] **`PaymentProcessedEvent`** — published on any successful payment
- [ ] **`PaymentFailedEvent`** — published on renewal failure → triggers failure email
- [ ] Event handlers do not block the main request flow

---

## 16. Transaction Logging

- [ ] Every successful payment logs a `completed` transaction
- [ ] Every failed payment logs a `failed` transaction
- [ ] Refunds are logged
- [ ] Renewals log correct `square_environment` (`production` vs `sandbox`)
- [ ] Cron errors log a `failed` transaction with `user_id: 0`

---

## 17. Test Mode / Sandbox

- [ ] `x-test-mode: true` header activates test mode (authorized users only)
- [ ] `mock_purchase: true` in request body activates test mode
- [ ] Sandbox payments go to Square Sandbox API
- [ ] Production payments go to Square Production API
- [ ] Renewal cron correctly routes sandbox cards to sandbox Square
- [ ] Sandbox banner appears in emails when test mode is active
- [ ] `square_environment` field stored on cards and subscriptions

---

## 18. Prorated Charge Calculation (`calculateProratedUseCase`)

- [ ] Correctly calculates days remaining in billing period
- [ ] Returns `0` if user has no existing subscription
- [ ] Returns `0` if new product costs the same or less
- [ ] Returns correct partial-period amount for upgrades
- [ ] Handles all durations: `daily`, `weekly`, `monthly`, `yearly`

---

## 19. Role Mapping (Plan Type Transitions)

- [ ] Single plan → Team plan: user role becomes `TEAMOWNER`
- [ ] Team plan → Single plan: user role becomes `AGENT`
- [ ] Same plan type: uses product's configured role

---

## 20. Whitelabel Support

- [ ] Products filtered correctly by `whitelabel_id` in signup and manage routes
- [ ] Whitelabel branding (colors, logo) falls back to defaults if not configured
- [ ] Whitelabel code → ID mapping is correct: `default=1, kw=2, yhs=3, iop=4, uco=5, mop=6, eco=7`

---

## 21. Infrastructure & Middleware

- [ ] **Error handler middleware** catches unhandled errors and returns structured response
- [ ] **Logging context middleware** attaches request ID to all log entries
- [ ] **Logging flush middleware** flushes log buffer at end of request
- [ ] **Digest middleware** functions correctly
- [ ] **BigInt serialization** — all BigInt values from DB serialize to strings (not `[object Object]`)
- [ ] **DB connection** — Kysely connects successfully to MySQL
- [ ] **`@api/` module alias** resolves correctly in all environments

---

## 22. Known TODOs to Confirm Before Go-Live

- [ ] `POST /manage/updatecard` — stub only, no Square card update implemented. **Confirm if blocking.**
- [ ] `suspendSubscriptionsCron` — commented out in cron route. **Confirm if suspension flow is required.**
- [ ] `downgrade_on_renewal` — cron skips these subscriptions but does not process the downgrade. **Confirm expected behavior.**
- [ ] HomeUptick addon subscription support — commented `TODO` in `renew-subscription.use-case.ts`. **Confirm if any active subscribers need this.**
- [ ] `GET /product/` — `TODO: Add support for filters and sorting` comment. **Confirm if filtering is needed.**

---

## 23. Environment Variables

Confirm all required env vars are set in production:

- [ ] `SQUARE_ACCESS_TOKEN` + `SQUARE_ENVIRONMENT`
- [ ] `API_URL`, `API_URL_V2`, `API_MASTER_TOKEN`, `API_KEY`
- [ ] `JWT_SECRET`
- [ ] `CRON_SECRET`
- [ ] `ADMIN_EMAIL`, `DEV_EMAIL`
- [ ] `SENDGRID_API_KEY` (or SMTP config for dev)
- [ ] `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- [ ] `APP_URL`
- [ ] `HOMEUPTICK_URL` (optional — confirm if needed)
