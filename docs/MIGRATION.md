# Complete Use Case Migration - Remaining Tasks

## Overview

This plan identifies every remaining task needed to complete the migration to clean architecture with use cases. The migration is currently in Phase 8 (Testing & Documentation), with most core functionality migrated but some endpoints still containing inline business logic.

## Current State Summary

- **14 use cases implemented** (3 payment + 10+ subscription + 1 product)
- **Payment routes:** ✅ Fully migrated (3/3 endpoints)
- **Purchase routes:** ✅ Fully migrated (1/1 endpoints)
- **Subscription routes:** ⚠️ Mostly migrated but needs cleanup (11 endpoints, some with inline logic)
- **Card routes:** ⚠️ Partially migrated (1/3 endpoints using use cases)
- **Product routes:** ⚠️ Partially migrated (1/4 endpoints using use cases)
- **Cron routes:** ❌ Not migrated
- **Property purchase route:** ❌ Legacy Express.js, not migrated
- **Email/Status routes:** ❌ Not migrated (low priority utilities)

---

## Remaining Tasks (Ordered by Priority)

### 🔴 HIGH PRIORITY - Core Business Logic Routes

#### 1. Card Routes - Extract GET endpoints to use cases

**Files:** [api/routes/hono/card.ts](api/routes/hono/card.ts)

**Tasks:**

- [ ] Create `GetUserCardUseCase` for `GET /:user_id` endpoint (currently has direct UserCard model query with inline error handling at lines 10-30)
- [ ] Create `CheckUserCardInfoUseCase` for `GET /:user_id/info` endpoint (currently has direct UserCard model query with conditional logic at lines 32-51)
- [ ] Update card route to use new use cases with `executeUseCase` helper
- [ ] Add input/output types to [api/use-cases/types/card.types.ts](api/use-cases/types/card.types.ts)
- [ ] Add Zod validation schemas to [api/use-cases/types/validation.schemas.ts](api/use-cases/types/validation.schemas.ts)
- [ ] Register new use cases in [api/container.ts](api/container.ts)
- [ ] Export from [api/use-cases/index.ts](api/use-cases/index.ts)

---

#### 2. Subscription Routes - Refactor POST / create/update endpoint

**Files:** [api/routes/hono/subscription.ts](api/routes/hono/subscription.ts:41-98)

**Issue:** Complex conditional logic mixing create and update operations with inline repository calls

**Tasks:**

- [ ] Create `UpdateSubscriptionUseCase` to handle the update branch (currently inline at lines 62-91)
- [ ] Refactor the POST / handler to use conditional logic: if subscription exists → `UpdateSubscriptionUseCase`, else → `CreateSubscriptionUseCase`
- [ ] Add input/output types for update operation to [api/use-cases/types/subscription.types.ts](api/use-cases/types/subscription.types.ts)
- [ ] Add Zod validation schema to [api/use-cases/types/validation.schemas.ts](api/use-cases/types/validation.schemas.ts)
- [ ] Register `UpdateSubscriptionUseCase` in [api/container.ts](api/container.ts)
- [ ] Export from [api/use-cases/index.ts](api/use-cases/index.ts)

---

#### 3. Subscription Routes - Extract DELETE endpoint logic

**Files:** [api/routes/hono/subscription.ts](api/routes/hono/subscription.ts:135-157)

**Issue:** Direct repository calls for deactivating/deleting subscriptions

**Tasks:**

- [ ] Create `DeactivateSubscriptionUseCase` to handle subscription deletion/deactivation
- [ ] Use case should handle: fetching subscription, setting status to disabled, saving, returning result
- [ ] Update DELETE / handler to use `DeactivateSubscriptionUseCase` with `executeUseCase` helper
- [ ] Add input/output types to [api/use-cases/types/subscription.types.ts](api/use-cases/types/subscription.types.ts)
- [ ] Add Zod validation schema to [api/use-cases/types/validation.schemas.ts](api/use-cases/types/validation.schemas.ts)
- [ ] Register use case in [api/container.ts](api/container.ts)
- [ ] Export from [api/use-cases/index.ts](api/use-cases/index.ts)

---

#### 4. Subscription Routes - Centralize authorization checks

**Files:** [api/routes/hono/subscription.ts](api/routes/hono/subscription.ts:200-325)

**Issue:** Repeated authorization logic in 4 endpoints (cancel, uncancel, downgrade, undowngrade)

**Tasks:**

- [ ] Create shared authorization utility or middleware for "admin or self" checks
- [ ] Consider moving authorization into use cases themselves (better separation of concerns)
- [ ] Refactor the 4 endpoints to use centralized authorization:
  - POST /cancel/:subscription_id (lines 200-216)
  - POST /uncancel/:subscription_id (lines 236-251)
  - POST /downgrade/:subscription_id (lines 271-286)
  - POST /undowngrade/:subscription_id (lines 310-325)
- [ ] Remove duplicate code

---

#### 5. Property Purchase Route - Complete migration from Express to Hono

**Files:** [api/routes/purchase/property/purchaseproperty.js](api/routes/purchase/property/purchaseproperty.js)

**Issue:** Legacy Express.js route with inline business logic

**Tasks:**

- [ ] Create `UnlockPropertyUseCase` to encapsulate the entire property unlock flow:
  - Fetch property from external API
  - Validate product exists
  - Charge card for property unlock
  - Update property unlock status via external API
  - Transaction logging
  - Email notifications
- [ ] Create new Hono route file [api/routes/hono/property.ts](api/routes/hono/property.ts)
- [ ] Implement `POST /:property_token` endpoint using `UnlockPropertyUseCase`
- [ ] Add input/output types to new file [api/use-cases/types/property.types.ts](api/use-cases/types/property.types.ts)
- [ ] Add Zod validation schema to [api/use-cases/types/validation.schemas.ts](api/use-cases/types/validation.schemas.ts)
- [ ] Register use case in [api/container.ts](api/container.ts)
- [ ] Export from [api/use-cases/index.ts](api/use-cases/index.ts)
- [ ] Update [api/app.ts](api/app.ts) to mount new property routes
- [ ] Delete old Express route file [api/routes/purchase/property/purchaseproperty.js](api/routes/purchase/property/purchaseproperty.js)

---

### 🟡 MEDIUM PRIORITY - Supporting Routes & Operations

#### 6. Product Routes - Extract GET operations

**Files:** [api/routes/hono/product.ts](api/routes/hono/product.ts)

**Tasks:**

- [ ] Create `GetProductUseCase` for `GET /:product_id` endpoint (currently direct Product model query at lines 9-20)
- [ ] Create `GetProductsUseCase` for `GET /` endpoint with filtering (currently direct Product model query with Where clause at lines 22-40)
- [ ] Update product route to use new use cases
- [ ] Add input/output types to [api/use-cases/types/product.types.ts](api/use-cases/types/product.types.ts)
- [ ] Add Zod validation schemas to [api/use-cases/types/validation.schemas.ts](api/use-cases/types/validation.schemas.ts)
- [ ] Register use cases in [api/container.ts](api/container.ts)
- [ ] Export from [api/use-cases/index.ts](api/use-cases/index.ts)

---

#### 7. Product Routes - Extract prorate calculation

**Files:** [api/routes/hono/product.ts](api/routes/hono/product.ts:60-82), [api/utils/checkProrated.js](api/utils/checkProrated.js)

**Issue:** POST /checkprorated calls legacy utility function instead of use case

**Tasks:**

- [ ] Create `CheckProratedChargeUseCase` wrapping the prorate calculation logic from [api/utils/checkProrated.js](api/utils/checkProrated.js)
- [ ] Use case should: validate inputs, fetch subscriptions, calculate prorated amount, return result
- [ ] Update POST /checkprorated handler to use new use case
- [ ] Add input/output types to [api/use-cases/types/product.types.ts](api/use-cases/types/product.types.ts)
- [ ] Add Zod validation schema to [api/use-cases/types/validation.schemas.ts](api/use-cases/types/validation.schemas.ts)
- [ ] Register use case in [api/container.ts](api/container.ts)
- [ ] Export from [api/use-cases/index.ts](api/use-cases/index.ts)

---

#### 8. Cron Routes - Wrap cron operations in use cases

**Files:** [api/routes/hono/cron.ts](api/routes/hono/cron.ts), [api/cron/subscriptionsCron.js](api/cron/subscriptionsCron.js), [api/cron/suspendSubscriptionsCron.js](api/cron/suspendSubscriptionsCron.js)

**Issue:** Cron endpoint directly calls cron functions without use case abstraction

**Tasks:**

- [ ] Create `ProcessSubscriptionRenewalsUseCase` to wrap [api/cron/subscriptionsCron.js](api/cron/subscriptionsCron.js) logic
- [ ] Create `ProcessSubscriptionSuspensionsUseCase` to wrap [api/cron/suspendSubscriptionsCron.js](api/cron/suspendSubscriptionsCron.js) logic
- [ ] Update cron route POST / handler to use both use cases
- [ ] Consider whether both operations should be in a single use case or separate
- [ ] Add input/output types to [api/use-cases/types/cron.types.ts](api/use-cases/types/cron.types.ts) (new file)
- [ ] Add Zod validation schemas to [api/use-cases/types/validation.schemas.ts](api/use-cases/types/validation.schemas.ts)
- [ ] Register use cases in [api/container.ts](api/container.ts)
- [ ] Export from [api/use-cases/index.ts](api/use-cases/index.ts)

---

### 🟢 LOW PRIORITY - Utility & Diagnostic Routes

#### 9. Email Routes - Wrap template preview utility (optional)

**Files:** [api/routes/hono/emails.ts](api/routes/hono/emails.ts)

**Complexity:** Low - simple utility route, migration optional

**Tasks:**

- [ ] Evaluate if email preview needs use case abstraction (likely not necessary)
- [ ] If needed, create `PreviewEmailTemplateUseCase`
- [ ] Otherwise, document as acceptable utility endpoint

---

#### 10. Status Routes - Wrap health check operations (optional)

**Files:** [api/routes/hono/status.ts](api/routes/hono/status.ts)

**Complexity:** Medium - orchestrates multiple service health checks

**Tasks:**

- [ ] Evaluate if health check needs use case abstraction
- [ ] If needed, create `CheckServiceHealthUseCase` to orchestrate:
  - Database connection check
  - SendGrid connection check
  - Square API check
  - Environment variable validation
- [ ] Otherwise, document as acceptable diagnostic endpoint

---

### 🧪 TESTING - Comprehensive Test Coverage

#### 11. Write tests for 7 new use cases from Phase 8

**Files:** [api/use-cases/](api/use-cases/)

**Missing Tests:**

- [ ] Write tests for `RefundPaymentUseCase` (target: 12-15 tests covering success, validation errors, refund failures, email notifications)
- [ ] Write tests for `GetPaymentsUseCase` (target: 8-10 tests covering pagination, filtering, permission checks)
- [ ] Write tests for `PauseSubscriptionUseCase` (target: 8-10 tests covering success, validation errors, invalid states)
- [ ] Write tests for `ResumeSubscriptionUseCase` (target: 8-10 tests covering success, validation errors, invalid states)
- [ ] Write tests for `CancelOnRenewalUseCase` (target: 8-10 tests covering mark/unmark, validation, admin emails)
- [ ] Write tests for `MarkForDowngradeUseCase` (target: 8-10 tests covering mark/unmark, validation, admin emails)
- [ ] Write tests for `GetSubscriptionsUseCase` (target: 8-10 tests covering pagination, filtering, permission checks)

---

#### 12. Write tests for newly created use cases (from tasks above)

**Will be created during implementation:**

**Card Use Cases:**

- [ ] Write tests for `GetUserCardUseCase` (target: 8-10 tests)
- [ ] Write tests for `CheckUserCardInfoUseCase` (target: 6-8 tests)

**Subscription Use Cases:**

- [ ] Write tests for `UpdateSubscriptionUseCase` (target: 12-15 tests)
- [ ] Write tests for `DeactivateSubscriptionUseCase` (target: 8-10 tests)

**Property Use Cases:**

- [ ] Write tests for `UnlockPropertyUseCase` (target: 15-18 tests covering API failures, payment failures, etc.)

**Product Use Cases:**

- [ ] Write tests for `GetProductUseCase` (target: 6-8 tests)
- [ ] Write tests for `GetProductsUseCase` (target: 8-10 tests)
- [ ] Write tests for `CheckProratedChargeUseCase` (target: 10-12 tests)

**Cron Use Cases:**

- [ ] Write tests for `ProcessSubscriptionRenewalsUseCase` (target: 15-20 tests)
- [ ] Write tests for `ProcessSubscriptionSuspensionsUseCase` (target: 10-12 tests)

---

#### 13. Integration tests for migrated routes

**Files:** New test files in [api/tests/integration/](api/tests/integration/)

**Tasks:**

- [ ] Create integration tests for card routes (GET endpoints)
- [ ] Create integration tests for subscription routes (POST /, DELETE /)
- [ ] Create integration tests for product routes (GET endpoints, checkprorated)
- [ ] Create integration tests for property unlock flow
- [ ] Create integration tests for cron operations
- [ ] Ensure tests cover authentication, authorization, validation, and error scenarios

---

### 📚 DOCUMENTATION & CLEANUP

#### 14. Update API documentation

**Files:** Create/update documentation in [docs/](docs/)

**Tasks:**

- [ ] Create API endpoint documentation with request/response examples
- [ ] Document all use cases with their inputs, outputs, and business rules
- [ ] Document authentication and authorization patterns
- [ ] Update [docs/MIGRATION_PROGRESS.md](docs/MIGRATION_PROGRESS.md) when Phase 8 is complete
- [ ] Create architecture diagram showing clean architecture layers

---

#### 15. Remove unused utilities and legacy code

**Files:** Various utility files in [api/utils/](api/utils/)

**Tasks:**

- [ ] Identify utility functions that have been replaced by use cases
- [ ] Remove or deprecate: [api/utils/checkProrated.js](api/utils/checkProrated.js) (after CheckProratedChargeUseCase is implemented)
- [ ] Remove or deprecate: [api/utils/chargeCardSingle.js](api/utils/chargeCardSingle.js) (if fully replaced by use cases)
- [ ] Audit [api/utils/](api/utils/) directory for other unused functions
- [ ] Remove old Express route directory: [api/routes/purchase/property/](api/routes/purchase/property/)
- [ ] Update imports across codebase

---

#### 16. Code quality improvements

**Files:** Various

**Tasks:**

- [ ] Run linter and fix any warnings
- [ ] Ensure all use cases follow consistent patterns (error handling, logging, validation)
- [ ] Ensure all routes use `executeUseCase` helper consistently
- [ ] Verify all error responses include appropriate error codes
- [ ] Audit logging statements for completeness and consistency
- [ ] Check for any remaining direct database queries outside repositories

---

### 🎯 FINAL VERIFICATION

#### 17. End-to-end testing

**Tasks:**

- [ ] Manual testing of complete purchase flow (property unlock, subscription purchase)
- [ ] Manual testing of subscription lifecycle (create, pause, resume, cancel)
- [ ] Manual testing of payment operations (create, refund)
- [ ] Manual testing of card operations (create, get)
- [ ] Test cron operations in staging environment
- [ ] Verify all emails are sent correctly with MJML templates
- [ ] Verify all error scenarios return appropriate messages and codes

---

#### 18. Performance and monitoring

**Tasks:**

- [ ] Review use case execution times (check logs)
- [ ] Ensure all database queries are optimized
- [ ] Verify transaction boundaries are correctly placed
- [ ] Check for N+1 query issues
- [ ] Ensure proper error tracking and logging

---

## Summary

### Task Count by Priority

- **🔴 HIGH PRIORITY:** 5 major tasks (Card routes, Subscription route refactors, Property migration)
- **🟡 MEDIUM PRIORITY:** 3 tasks (Product routes, Cron routes)
- **🟢 LOW PRIORITY:** 2 tasks (Email routes, Status routes - optional)
- **🧪 TESTING:** 3 major test suites (existing use cases, new use cases, integration tests)
- **📚 DOCUMENTATION:** 3 tasks (API docs, cleanup, code quality)
- **🎯 VERIFICATION:** 2 tasks (E2E testing, performance)

### Estimated Work Breakdown

- **Use Cases to Create:** 11-13 new use cases
- **Tests to Write:** 180-220 individual tests (for 11-13 new use cases)
- **Routes to Refactor:** 6 route files
- **Documentation:** Comprehensive API and architecture docs

### Success Criteria

✅ All routes use use cases for business logic (no inline queries/logic)
✅ All use cases have comprehensive tests (80%+ coverage)
✅ All routes use `executeUseCase` helper consistently
✅ No direct model/repository calls in route handlers
✅ No legacy Express code remaining
✅ All tests passing (target: 400+ tests)
✅ API documentation complete
✅ Clean architecture verified end-to-end

---

## Recommended Order of Execution

**Week 1-2:** Complete HIGH priority tasks (Card, Subscription, Property routes)
**Week 3:** Complete MEDIUM priority tasks (Product, Cron routes)
**Week 4:** Write all use case tests
**Week 5:** Integration tests and documentation
**Week 6:** Cleanup, verification, and final testing

This plan ensures a systematic completion of the migration with quality and consistency maintained throughout.
