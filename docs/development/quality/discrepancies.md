# Discrepancies

Known mismatches, unclear rules, stubs, and things requiring investigation.

---

## DISC-001: Square Card Update Not Implemented

**Type**: stub/TODO

**Description**: The manage endpoint (`POST /api/manage/card`) logs the intent to update a card via Square but does not execute the Square API call.

**Location**: `api/routes/manage/routes.ts:346`

**Source of truth**: The Square SDK supports card updates. This needs to be implemented.

**Next action**:
- [ ] Implement Square card update logic in manage route

---

## DISC-002: HomeUptick Tier-Based Renewal Incomplete

**Type**: stub/TODO

**Description**: `renew-subscription.use-case.ts:114` has a commented TODO for HomeUptick tier-based renewal cost calculation. The integration test `renewal-homeuptick-tiers.test.ts` covers this but the use case may not be fully wired.

**Location**: `api/use-cases/subscription/renew-subscription.use-case.ts:114`

**Next action**:
- [ ] Verify whether tier-based renewal actually works in the current code
- [ ] If not, implement the TODO and update the integration test

---

## DISC-003: Suspension Cron Is Stubbed

**Type**: stub/TODO

**Description**: The suspension cron (`suspendSubscriptionsCron`) is referenced in `api/routes/cron/routes.ts` but the function does not exist. Automatic suspension after max payment retries does not happen.

**Location**: `api/routes/cron/routes.ts` (commented out)

**Next action**:
- [ ] Implement `suspendSubscriptionsCron`
- [ ] Wire it to the cron route
- [ ] Add integration test in `retry-and-suspension.test.ts`

---

## DISC-004: Square Webhook Handler Status Unclear

**Type**: unclear rule / missing enforcement

**Description**: Square is configured to send payment webhooks but the handler location and implementation status is unclear from the codebase audit.

**Next action**:
- [ ] Confirm whether Square webhooks are handled
- [ ] Document the handler location
- [ ] Add test if handler exists

---

## DISC-005: Upgrade/Downgrade User Config Not Implemented

**Type**: missing enforcement

**Description**: When a user upgrades or downgrades between plans, the system should update their role, premium status, and whitelabel in the main API according to the new product's `user_config`. This is documented as a future implementation in CLAUDE.md but is not currently wired.

**Next action**:
- [ ] Implement upgrade/downgrade user config update
- [ ] Apply role mapping via `role-mapper.ts`
- [ ] Add tests

---

## DISC-006: Suspension User Config Revert Not Implemented

**Type**: missing enforcement

**Description**: When a user's subscription is suspended (future automation), their premium status should be reverted. This is documented as a future implementation.

**Next action**:
- [ ] Implement when suspension cron is implemented (DISC-003)

---

## DISC-007: DEVELOPER_ONBOARDING.md Referenced `npm` — Now Uses `yarn`

**Type**: doc/code mismatch (resolved by removing old doc)

**Status**: Resolved — old DEVELOPER_ONBOARDING.md removed. Info captured in `/docs/development/runbooks/local-setup.md`.

---

## DISC-008: Permission Strings Not Documented Locally

**Type**: missing documentation

**Description**: The canonical list of permission strings (e.g., `payments_create`) lives in the main CashOffers API, not in this repo. This makes it hard to audit authorization.

**Next action**:
- [ ] Document known permission strings in [Authorization Rules](../../business/rules/authorization-rules.md)
- [ ] Confirm list with main API team
