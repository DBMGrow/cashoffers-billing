# Remove DI Container — Migration Plan

## Problem

`api/container.ts` (~470 lines) wires 60+ objects into a global singleton exposed via `getContainer()`. Routes use it as a service locator — calling `getContainer()` inside every handler. Tests bypass it entirely, instantiating use cases directly with mocks. The container adds maintenance overhead (adding a use case requires touching 4 files) without delivering testability benefits that couldn't be achieved more simply.

## Goal

Replace the container with module-level singletons co-located with their domain. Routes import named singletons directly. Tests continue working unchanged.

---

## What Changes (and What Doesn't)

**Kept unchanged:**
- All 19 use case classes and their `Dependencies` interfaces
- All result types (`UseCaseResult<T>`, `success()`, `failure()`)
- All infrastructure interfaces (`IPaymentProvider`, `IEmailService`, `ILogger`, `IEventBus`, `IUserApiClient`)
- All test files — tests already instantiate use cases directly with mocks
- `api/config/config.service.ts` — existing `config` singleton
- `api/lib/database.ts` — existing `db` singleton

**Removed:**
- `api/container.ts`
- `api/container.test.ts`
- All 8 repository interface files under `api/infrastructure/database/repositories/*.interface.ts`

---

## New Files

### `api/lib/repositories.ts`
All 7 repository singletons, built on the existing `db` singleton.

### `api/lib/services.ts`
All infrastructure singletons: logger, transaction manager, event bus (with handlers registered), payment provider, email service, user API client, health services, config service wrapper.

Initialization order:
1. `baseLogger` (console-only)
2. `billingLogRepository` (from repositories.ts — needed for DatabaseLogger)
3. `logger` (DatabaseLogger wrapping baseLogger)
4. `transactionManager`
5. `mjmlCompiler`
6. `eventBus` (InMemoryEventBus)
7. `paymentProvider` (dual-environment Square)
8. `emailService`, `userApiClient`, `paymentErrorTranslator`
9. `healthMetricsService`, `healthReportService`, `criticalAlertService`
10. Register 5 event handlers on eventBus
11. `configService` wrapper for use cases

### `api/use-cases/payment/index.ts`
Singletons: `createPaymentUseCase`, `refundPaymentUseCase`, `createCardUseCase`, `getPaymentsUseCase`

### `api/use-cases/subscription/index.ts`
Singletons: `createSubscriptionUseCase`, `renewSubscriptionUseCase`, `pauseSubscriptionUseCase`, `resumeSubscriptionUseCase`, `cancelOnRenewalUseCase`, `markForDowngradeUseCase`, `updateSubscriptionFieldsUseCase`, `getSubscriptionsUseCase`, `purchaseSubscriptionUseCase`, `deactivateSubscriptionUseCase`, `calculateProratedUseCase`

### `api/use-cases/card/index.ts`
Singletons: `getUserCardUseCase`, `checkUserCardInfoUseCase`

### `api/use-cases/product/index.ts`
Singleton: `createProductUseCase`

### `api/use-cases/property/index.ts`
Singleton: `unlockPropertyUseCase`

---

## Files Updated

| File | Change |
|------|--------|
| `api/routes/payment/routes.ts` | Import use cases from `@api/use-cases/payment` |
| `api/routes/subscription/routes.ts` | Import use cases from `@api/use-cases/subscription` |
| `api/routes/card/routes.ts` | Import use cases from `@api/use-cases/card` |
| `api/routes/purchase/routes.ts` | Import use cases + repositories + services directly |
| `api/routes/product/routes.ts` | Import `productRepository` from `@api/lib/repositories` |
| `api/routes/cron/routes.ts` | Import `config`, `healthReportService` from `@api/lib/services` |
| `api/routes/property/routes.ts` | Import use case from `@api/use-cases/property` |
| `api/cron/subscriptionsCron.ts` | Import repos, services, logger, config, use case directly |
| Test mock files | Remove `implements I*Repository` clauses (or the interface import) |

---

## Before / After

**Before (route pattern):**
```typescript
const container = getContainer()
container.useCases.createPayment.execute(input)
```

**After:**
```typescript
import { createPaymentUseCase } from '@api/use-cases/payment'
createPaymentUseCase.execute(input)
```

**Before (cron):**
```typescript
const container = getContainer()
const subscriptionRepository = container.repositories.subscription
const renewSubscriptionUseCase = container.useCases.renewSubscription
```

**After:**
```typescript
import { subscriptionRepository } from '@api/lib/repositories'
import { renewSubscriptionUseCase } from '@api/use-cases/subscription'
```

---

## Verification

```bash
npm run build   # No type errors
npm test        # All tests pass
```
