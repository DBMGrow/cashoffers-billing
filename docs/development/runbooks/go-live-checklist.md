# Go-Live Migration Checklist

Definitive checklist for cutting over from the legacy billing system (Express/Sequelize on `main`) to the new system (Next.js/Hono/Kysely on `staging`). Both systems share the same MySQL database.

**Key constraints:**
- The old app runs at `billing.cashoffers.com` and must keep working until the moment of cutover.
- The new app will be deployed to a new DigitalOcean App Platform instance at `account.cashoffers.pro`.
- Rollback = revert DNS and re-enable the old app. The database must remain compatible with old code until we're confident.

---

## Phase 0 — Pre-Migration Prep (days before go-live)

These items can be completed well in advance. None affect the running production system.

### Environment & Secrets

- [ ] **Configure `.env.production`** with live credentials via `yarn dev:tools env edit --env production`:
  - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` — production MySQL
  - `SQUARE_ACCESS_TOKEN`, `NEXT_PUBLIC_SQUARE_APP_ID`, `NEXT_PUBLIC_SQUARE_LOCATION_ID` — production Square
  - `SQUARE_ENVIRONMENT=production`
  - `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
  - `API_URL`, `API_MASTER_TOKEN`, `API_KEY` — CashOffers main API
  - `JWT_SECRET` — new, strong random value
  - `CRON_SECRET` — new value (not `default-cron-secret`)
  - `CASHOFFERS_WEBHOOK_SECRET` — if using webhook verification
  - `DEV_EMAIL`, `ADMIN_EMAIL`
  - `APP_URL=https://account.cashoffers.pro`
  - `NEXT_PUBLIC_DASHBOARD_URL` — production dashboard URL
  - `HOMEUPTICK_URL` — if applicable
  - `NODE_ENV=production`
- [ ] **Store `DOTENV_PRIVATE_KEY_PRODUCTION`** in Keeper and in the DigitalOcean App Platform env vars
- [ ] **Verify decryption** works: `yarn dev:tools env setup --env production`

### App Platform Instance

- [ ] **Create new DigitalOcean App Platform app** at `account.cashoffers.pro`
  - Set build command: `dotenvx run --env-file=.env.production -- next build`
  - Set run command: `dotenvx run --env-file=.env.production -- next start`
  - Set `DOTENV_PRIVATE_KEY_PRODUCTION` as an App Platform environment variable
  - Region: same as database for lowest latency
  - Instance size: adequate for connection pool (10 DB connections per instance)
- [ ] **Configure the App Platform app to deploy from the `staging` branch** (or `main` after merge)
- [ ] **Do NOT configure a custom domain yet** — first deploy will use the App Platform default URL for testing

### Safe Migrations (run while old app is live)

These migrations are **additive only** — they create new tables or add nullable/defaulted columns that the old code ignores.

- [ ] **Back up the database** before running any migrations
- [ ] Run migration **001** — Create `PurchaseRequests` table (new table)
- [ ] Run migration **002** — Add `square_environment` to Transactions, UserCards, Subscriptions (nullable, defaults to `production`)
- [ ] Run migration **003** — Add `suspension_behavior` to Whitelabels (new column with default)
- [ ] Run migration **004** — Create `BillingLogs` table (new table)
- [ ] Run migration **005** — Add `data` JSON to Whitelabels + seed branding (new column)
- [ ] Run migration **006** — Add `whitelabel_code` to Products (new column, backfilled from JSON)
- [ ] Run migration **007** — Make `Subscriptions.user_id` nullable, add `provisioning_status` (relaxes constraint)
- [ ] Run migration **008** — Add `payment_failure_count` to Subscriptions (new column, default 0)
- [ ] Run migration **010** — Add `product_category` to Products (new column, default `premium_cashoffers`)
- [ ] Run migration **012** — Insert SHELL and HOMEUPTICK roles into Roles table
- [ ] **Verify old app still works** after safe migrations — spot-check a subscription page, confirm cron runs normally

### Testing

- [ ] **Deploy new app to App Platform** using the default URL (no custom domain)
- [ ] **Run health check**: `GET /api/health` on the App Platform URL
- [ ] **Verify startup diagnostics** — check logs for `[config-diagnostic]` output, confirm secrets are loaded (masked)
- [ ] **Test signup flow end-to-end** on staging/App Platform URL using a sandbox Square card
- [ ] **Test manage flow** — login, view subscription, update card
- [ ] **Test the cron endpoint** manually: `POST /api/cron/subscriptions` with `CRON_SECRET` — dry-run against production data (ensure it doesn't charge; or run against staging DB)
- [ ] **Verify email delivery** — confirm SendGrid sends from correct address and templates render properly

---

## Phase 1 — Migration Day: Preparation

Start this phase during a low-traffic window (early morning or weekend). Target: minimize the window where no cron runs.

### Freeze Active Operations

- [ ] **Disable the renewal cron job** — remove or pause the external scheduler that calls `POST /api/cron/subscriptions` on the old app. Record the exact time of disabling.
  > The cron is the riskiest component during cutover. With it disabled, no payments are processed and no subscriptions change state. After cutover, any missed renewals will be picked up on the first cron run against the new app.

### Database Backup & Destructive Migrations

> **Important: never DROP or RENAME the Products table.** `Subscriptions` has a FK constraint (`Subscriptions_ibfk_1 FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE SET NULL ON UPDATE CASCADE`) and `PurchaseRequests` has one with `ON DELETE RESTRICT`. Dropping Products would either fail or orphan every subscription's product reference. All operations must be in-place UPDATEs.

- [ ] **Take a full database backup** (this is the rollback snapshot)
- [ ] **Clone the Products table for rollback**:
  ```sql
  CREATE TABLE Products_backup AS SELECT * FROM Products;
  ```
  This preserves every row's original `data` JSON so we can reverse migration 011 with a simple UPDATE join.
- [ ] Run migration **009** — Normalize subscription status values (`suspend`→`suspended`, `cancel`→`cancelled`, `pause`→`paused`, `downgrade`→`active`). Safe: no schema change, just data cleanup.
- [ ] Run migration **011** — Restructure `Products.data` JSON in-place (moves `user_config` into `cashoffers.user_config`, adds `managed` flag). These are UPDATE statements by `product_id` — PKs, FKs, indexes, and auto_increment all stay intact. **Old code cannot read the new JSON format after this runs.**
- [ ] Run migration **013** — Update homeuptick_only products role from SHELL to HOMEUPTICK in JSON data.
- [ ] **Verify product data** — spot-check a few products to confirm the JSON restructure looks correct:
  ```sql
  SELECT product_id, product_name, product_category,
    JSON_EXTRACT(data, '$.cashoffers.managed') as managed,
    JSON_EXTRACT(data, '$.cashoffers.user_config.role') as role
  FROM Products WHERE product_id IN (1, 2, 11, 54) \G
  ```

> **Rollback for Products**: If you need to revert, restore the original `data` column from the backup — no table drops needed:
> ```sql
> UPDATE Products p
> JOIN Products_backup pb ON p.product_id = pb.product_id
> SET p.data = pb.data;
> ```
> This reverses only the `data` JSON changes. The additive columns (`product_category`, `whitelabel_code`) remain — the old code ignores them.

### Reconcile Subscriptions

After products are restructured, run the reconciliation script to match each subscription to its correct product and rebuild subscription.data in the new format.

- [ ] **Dry run first**:
  ```bash
  dotenvx run --env-file=.env.production -- npx tsx scripts/reconcile-subscriptions.ts --verbose
  ```
  Review the report. All subscriptions should either be `data_updated` (product_id correct, data rebuilt) or `reassigned` (product_id corrected). Any `FAILED` entries must be resolved manually before proceeding.
- [ ] **Resolve any failures** — subscriptions that fail to match have a price mismatch or missing product for their whitelabel. These need manual review (custom pricing, grandfathered plans, etc.)
- [ ] **Commit changes**:
  ```bash
  dotenvx run --env-file=.env.production -- npx tsx scripts/reconcile-subscriptions.ts --commit
  ```
  The script runs all updates in a single transaction. If any subscriptions are in FAILED status, it aborts without writing anything.
- [ ] **Spot-check a few subscriptions** to confirm the data looks correct:
  ```sql
  SELECT subscription_id, product_id, amount, JSON_EXTRACT(data, '$.cashoffers') as cashoffers,
    JSON_EXTRACT(data, '$.team_id') as team_id, JSON_EXTRACT(data, '$.renewal_cost') as renewal_cost
  FROM Subscriptions WHERE status = 'active' LIMIT 5 \G
  ```

---

## Phase 2 — Migration Day: Deploy & Verify

- [ ] **Trigger a fresh deploy** of the new app on App Platform (if not already running the latest code)
- [ ] **Verify the new app starts cleanly** — check logs for:
  - No `Missing required environment variables` errors
  - `[config-diagnostic]` shows production Square token (masked)
  - `SQUARE_ENVIRONMENT: production`
  - Database connection pool established
- [ ] **Hit the health endpoint**: `GET https://<app-platform-url>/api/health`
- [ ] **Test a real signup flow** against production (use a real card with a small product, or a $0 free-tier product)
- [ ] **Test the manage flow** — log in as an existing user, confirm their subscription data loads correctly
- [ ] **Verify product listing** — `GET /api/product/products` returns products with correct new data structure

---

## Phase 3 — Migration Day: Cutover

### DNS & Routing

- [ ] **Configure custom domain** `account.cashoffers.pro` on the App Platform app
- [ ] **Add DNS records** — point `account.cashoffers.pro` to the App Platform instance (CNAME or A record per DO instructions)
- [ ] **Wait for SSL certificate** to provision (App Platform handles this automatically, but verify)
- [ ] **Verify** `https://account.cashoffers.pro/api/health` returns OK

### Re-enable Cron

- [ ] **Update the external cron scheduler** to point to the new app:
  - URL: `https://account.cashoffers.pro/api/cron/subscriptions`
  - Secret: the new `CRON_SECRET` value from `.env.production`
  - Method: POST with JSON body `{ "secret": "<CRON_SECRET>" }`
- [ ] **Trigger the cron manually once** to catch any renewals that were due during the migration window
- [ ] **Monitor the first cron run** — check `BillingLogs` table and app logs for:
  - Subscriptions processed count
  - Any payment failures (expected for cards that would have failed anyway)
  - No unexpected errors

### Update External References

- [ ] **Update signup links** across whitelabel partner sites to use `account.cashoffers.pro` URLs (per `products.csv` format: `account.cashoffers.pro/{whitelabel}/signup/{product_id}`)
- [ ] **Update any CashOffers main app references** that link to the billing/manage portal
- [ ] **Update webhook sender** (if CashOffers main API sends webhooks to billing) to point to `https://account.cashoffers.pro/api/webhooks/cashoffers`

---

## Phase 4 — Post-Cutover Validation (first 24-48 hours)

### Immediate (first hour)

- [ ] **Monitor app logs** for errors — watch for payment failures, API timeout, DB connection issues
- [ ] **Verify a real renewal processes** — wait for or trigger a cron run and confirm a subscription renews successfully
- [ ] **Verify email delivery** — confirm renewal emails, trial warnings, and failure notifications are sending
- [ ] **Check Square Dashboard** — confirm transactions are appearing in the production Square account

### First Day

- [ ] **Monitor the next scheduled cron run** — confirm it processes the expected number of subscriptions
- [ ] **Check for payment retry subscriptions** — any subscriptions with `payment_failure_count > 0` should have their `next_renewal_attempt` respected
- [ ] **Verify pause/resume works** — test pausing and resuming a subscription through the manage UI
- [ ] **Verify cancel-on-renewal works** — set a subscription to cancel on renewal, confirm the flag is saved
- [ ] **Spot-check team subscriptions** — confirm `team_id` is present in subscription data for team plans and team member toggle works

### First Week

- [ ] **Compare transaction volume** — confirm daily transaction counts match expected patterns (compare with pre-migration period)
- [ ] **Review `BillingLogs` for errors** — query for `level = 'error'` entries
- [ ] **Verify HomeUptick integration** — if applicable, confirm addon charges are being calculated correctly on renewals
- [ ] **Test a real upgrade flow** — have a user upgrade their plan, confirm proration calculates correctly

---

## Phase 5 — Cleanup (once stable, 1-2 weeks after)

### Database

- [ ] **Drop `Products_backup` table** once confident the migration is permanent
- [ ] **Apply status ENUM migration** — create a new migration that converts `Subscriptions.status` from VARCHAR to ENUM now that old code is fully decommissioned:
  ```sql
  ALTER TABLE Subscriptions
    MODIFY COLUMN status ENUM('active','suspended','cancelled','disabled','trial','paused','inactive','expired') NULL DEFAULT NULL;
  ```
- [ ] **Clean up any orphaned data** — check for subscriptions with `provisioning_status = 'pending_provisioning'` that need manual resolution

### Infrastructure

- [ ] **Decommission the old app** — shut down the old DigitalOcean deployment (Docker container / droplet)
- [ ] **Update or redirect `billing.cashoffers.com`** — either redirect to `account.cashoffers.pro` or decommission the domain
- [ ] **Archive the old CI/CD workflow** (already in `.github/workflows_old/`) — set up new CI/CD if desired
- [ ] **Rotate secrets** — run `yarn dev:tools env rotate` now that the old app no longer needs the old credentials. Update Keeper, GitHub Actions secrets, and App Platform env vars per the post-rotation checklist.

### Code

- [ ] **Merge `staging` into `main`** (or rebase/replace main with staging)
- [ ] **Remove legacy compatibility code** if any was added for the cutover window
- [ ] **Update `products.csv`** with final production signup URLs

---

## Rollback Plan

If critical issues are discovered after cutover:

### Quick Rollback (< 1 hour after cutover)

1. **Disable the cron** (prevent further processing)
2. **Revert DNS** — point `account.cashoffers.pro` away from App Platform (or remove custom domain)
3. **Restore Products data from backup** (in-place UPDATE, preserves all FKs and indexes):
   ```sql
   UPDATE Products p
   JOIN Products_backup pb ON p.product_id = pb.product_id
   SET p.data = pb.data;
   ```
4. **Re-enable the old app** and point the cron back to it
5. The old app reads from `Subscriptions` and `Products` — additive columns (`product_category`, `whitelabel_code`, `payment_failure_count`, etc.) are invisible to it, and status normalization (009) is compatible

### Late Rollback (> 1 hour, new subscriptions may exist)

1. Follow quick rollback steps above
2. **Audit new subscriptions** created by the new app — they have `renewal_cost` and `duration` in the data blob (backwards-compatible) but check that `team_id` is present for any team subscriptions
3. **Audit status values** — the new app only writes valid long-form statuses (`active`, `suspended`, etc.) so the old code can read them, but the old code may write shorthand values again (`cancel`, `suspend`) until the ENUM migration is applied
4. **Check for new products** — if any products were created through the new admin UI during the cutover window, their `data` column will be in the new format. The backup UPDATE only restores rows that existed at backup time; new rows are untouched and would need manual attention

---

## Reference: Migration Safety Matrix

| Migration | Description | Safe while old app runs? | Rollback impact |
|-----------|-------------|--------------------------|-----------------|
| 001 | Create PurchaseRequests | Yes (new table) | Drop table |
| 002 | Add square_environment | Yes (nullable columns) | Drop columns |
| 003 | Whitelabel suspension_behavior | Yes (new column) | Drop column |
| 004 | Create BillingLogs | Yes (new table) | Drop table |
| 005 | Whitelabel branding data | Yes (new column) | Drop column |
| 006 | Product whitelabel_code | Yes (new column) | Drop column |
| 007 | Subscriptions.user_id nullable | Yes (relaxes constraint) | Re-add NOT NULL |
| 008 | payment_failure_count | Yes (new column, default 0) | Drop column |
| 009 | Normalize status values | Yes (data fix, no schema change) | No action needed |
| 010 | Product category | Yes (new column, default) | Drop column |
| **011** | **Restructure Products.data JSON** | **No — destructive** | `UPDATE Products p JOIN Products_backup pb ON p.product_id = pb.product_id SET p.data = pb.data` |
| 012 | Add SHELL/HOMEUPTICK roles | Yes (insert rows) | Delete rows |
| **013** | **Update product role values** | **No — depends on 011** | Covered by 011 rollback (same `data` column) |
