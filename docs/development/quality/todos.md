# TODOs

Active implementation gaps tracked here. Link to discrepancy if one exists.

---

## High Priority

### TODO-001: Implement Square Card Update
- **File**: `api/routes/manage/routes.ts:346`
- **What**: Users need to update their card on file. The logic is stubbed.
- **See**: [DISC-001](discrepancies.md#disc-001-square-card-update-not-implemented)

### TODO-002: Implement Suspension Cron
- **File**: `api/routes/cron/routes.ts`
- **What**: After max payment retries, subscriptions should be automatically suspended.
- **See**: [DISC-003](discrepancies.md#disc-003-suspension-cron-is-stubbed)

---

## Medium Priority

### TODO-003: Implement Upgrade/Downgrade User Config Update
- **File**: `api/use-cases/subscription/` (purchase helpers)
- **What**: When upgrading/downgrading, apply new product's `user_config` to user in main API
- **See**: [DISC-005](discrepancies.md#disc-005-upgradedowngrade-user-config-not-implemented)

### TODO-004: Verify HomeUptick Tier-Based Renewal
- **File**: `api/use-cases/subscription/renew-subscription.use-case.ts:114`
- **What**: Confirm tier-based cost calculation is wired; implement if not
- **See**: [DISC-002](discrepancies.md#disc-002-homeuptick-tier-based-renewal-incomplete)

### TODO-005: Migrate to dotenvx
- **What**: Replace plain `.env` with encrypted dotenvx for better secrets management
- **See**: [dotenvx decision](../../business/decisions/dotenvx-todo.md)

---

## Low Priority

### TODO-006: Document Permission Strings
- **What**: Capture known permission strings from main API in authorization rules
- **See**: [DISC-008](discrepancies.md#disc-008-permission-strings-not-documented-locally)

### TODO-007: Add Product Filter/Sort Support
- **File**: `api/routes/product/routes.ts:27`
- **What**: `GET /product/` returns all products; no filter or sort support

### TODO-008: Add CLI Scenarios for Pause/Resume and Cancel on Renewal
- **File**: `scripts/dev.ts`
- **What**: Dev CLI has no scenarios for these common operations
