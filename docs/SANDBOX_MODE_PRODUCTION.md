# Implementation Plan: Dual Square Environment Support

## Context

**Problem:** The billing system needs a way to test the complete payment flow (including card creation, payments, and subscriptions) in production without charging real cards. Square's sandbox test cards only work in Square's sandbox environment, not in production.

**Solution:** Support both Square production AND sandbox environments simultaneously, with dynamic per-request switching. This allows using Square's real sandbox infrastructure (with test cards) while the application runs against production database/services.

**Key User Requirements:**
- Query parameter on purchase endpoint to enable test mode even without existing user
- Environment tracking on transactions to distinguish sandbox vs production
- Environment tracking on cards to distinguish sandbox vs production
- **Subscription renewals must use the same environment as the original subscription/card** (critical for consistency)

## Architecture Overview

The implementation uses a **Dual-Client Provider Pattern**:

1. **Two Square Clients**: One for production, one for sandbox (both initialized at startup)
2. **Context-Aware Wrapper**: `DualEnvironmentPaymentProvider` routes requests to appropriate client
3. **Test Mode Detection**: Multiple triggers (query param, user flag, email pattern)
4. **Database Tracking**: Add `square_environment` columns to track which environment was used
5. **Environment Persistence**: Subscriptions remember their environment and always renew in the same environment
6. **Backward Compatible**: Existing code works unchanged, test mode is opt-in

## Subscription Renewal Flow

**Initial Purchase with Test Mode:**
1. User purchases subscription with `?test_mode=true`
2. Card created in Square sandbox → stored with `square_environment='sandbox'`
3. Initial payment processed in sandbox → transaction stored with `square_environment='sandbox'`
4. Subscription created → stored with `square_environment='sandbox'`

**Automated Renewal (Cron):**
1. Cron finds subscriptions due for renewal
2. For each subscription, looks up card and checks `square_environment`
3. Creates `PaymentContext` with `testMode = (environment === 'sandbox')`
4. Renewal payment processed in correct environment (sandbox for sandbox subscriptions)
5. Transaction logged with correct `square_environment`

**Result:** Complete environment isolation - sandbox subscriptions never accidentally charge production cards, and production subscriptions never use sandbox.

## Implementation Steps

### Phase 1: Configuration & Database

#### 1.1 Update Configuration Interface
**File:** [src/config/config.interface.ts](src/config/config.interface.ts)

Add payment context interface and expand Square config:
```typescript
export interface PaymentContext {
  testMode: boolean
  source?: 'API' | 'CRON' | 'ADMIN'
  userId?: number
  metadata?: Record<string, unknown>
}

export interface IConfig {
  // ... existing fields
  square: {
    production: {
      accessToken: string
      locationId: string
    }
    sandbox: {
      accessToken: string
      locationId: string
    }
    defaultEnvironment: 'production' | 'sandbox'
  }
}
```

#### 1.2 Update Configuration Service
**File:** [src/config/config.service.ts](src/config/config.service.ts)

- Load both `SQUARE_ACCESS_TOKEN` (production) and `SQUARE_SANDBOX_ACCESS_TOKEN`
- Load both `SQUARE_LOCATION_ID` and `SQUARE_SANDBOX_LOCATION_ID`
- Make sandbox credentials optional (for backward compatibility)
- Validate production credentials as required
- If only production credentials exist, sandbox is disabled

#### 1.3 Database Migration
**File:** `src/database/migrations/002_add_square_environment_tracking.sql` (NEW)

```sql
-- Add environment tracking to Transactions
ALTER TABLE Transactions
ADD COLUMN square_environment ENUM('production', 'sandbox')
DEFAULT 'production'
AFTER square_transaction_id;

-- Add environment tracking to UserCards
ALTER TABLE UserCards
ADD COLUMN square_environment ENUM('production', 'sandbox')
DEFAULT 'production'
AFTER square_customer_id;

-- Add environment tracking to Subscriptions
ALTER TABLE Subscriptions
ADD COLUMN square_environment ENUM('production', 'sandbox')
DEFAULT 'production'
AFTER product_id;

-- Add indexes for environment filtering
CREATE INDEX idx_transactions_environment ON Transactions(square_environment);
CREATE INDEX idx_user_cards_environment ON UserCards(square_environment);
CREATE INDEX idx_subscriptions_environment ON Subscriptions(square_environment);

-- Backfill existing records
UPDATE Transactions SET square_environment = 'production' WHERE square_environment IS NULL;
UPDATE UserCards SET square_environment = 'production' WHERE square_environment IS NULL;
UPDATE Subscriptions SET square_environment = 'production' WHERE square_environment IS NULL;
```

#### 1.4 Regenerate Database Types
Run `npm run codegen` to update [src/lib/db.d.ts](src/lib/db.d.ts) with new columns.

### Phase 2: Payment Provider Layer

#### 2.1 Extend Payment Provider Interface
**File:** [src/infrastructure/payment/payment-provider.interface.ts](src/infrastructure/payment/payment-provider.interface.ts)

Add optional `context` parameter to all methods and `environment` to all results:
```typescript
export interface IPaymentProvider {
  createPayment(request: CreatePaymentRequest, context?: PaymentContext): Promise<PaymentResult>
  createCard(request: CreateCardRequest, context?: PaymentContext): Promise<CardResult>
  getCard(cardId: string, context?: PaymentContext): Promise<CardInfo>
  refundPayment(request: RefundPaymentRequest, context?: PaymentContext): Promise<RefundResult>
}

export interface PaymentResult {
  // ... existing fields
  environment: 'production' | 'sandbox'
}

export interface CardResult {
  // ... existing fields
  environment: 'production' | 'sandbox'
}
```

#### 2.2 Create Dual Environment Provider
**File:** `src/infrastructure/payment/dual-environment-provider.ts` (NEW)

Core routing logic:
```typescript
export class DualEnvironmentPaymentProvider implements IPaymentProvider {
  constructor(
    private productionProvider: IPaymentProvider,
    private sandboxProvider: IPaymentProvider | null,
    private logger: ILogger
  ) {}

  async createPayment(request: CreatePaymentRequest, context?: PaymentContext): Promise<PaymentResult> {
    const provider = this.selectProvider(context)
    const result = await provider.createPayment(request, context)
    return {
      ...result,
      environment: context?.testMode ? 'sandbox' : 'production'
    }
  }

  private selectProvider(context?: PaymentContext): IPaymentProvider {
    if (context?.testMode) {
      if (!this.sandboxProvider) {
        throw new Error('Sandbox mode requested but sandbox credentials not configured')
      }
      this.logger.info('[TEST MODE] Using Square sandbox environment')
      return this.sandboxProvider
    }
    return this.productionProvider
  }

  // Similar for createCard, getCard, refundPayment...
}
```

#### 2.3 Update Square Provider for Environment Awareness
**File:** [src/infrastructure/payment/square/square.provider.ts](src/infrastructure/payment/square/square.provider.ts)

- Accept environment-specific config (production or sandbox)
- Add environment to log messages
- Factory function signature becomes: `createSquarePaymentProvider(config, logger, environment: 'production' | 'sandbox')`

### Phase 3: Test Mode Detection

#### 3.1 Create Test Mode Detector Service
**File:** `src/infrastructure/payment/test-mode-detector.ts` (NEW)

```typescript
export interface ITestModeDetector {
  detectTestMode(request: HonoRequest, user?: any): PaymentContext
}

export class TestModeDetector implements ITestModeDetector {
  detectTestMode(request: HonoRequest, user?: any): PaymentContext {
    const testMode =
      request.query('test_mode') === 'true' ||
      request.header('X-Test-Mode') === 'true' ||
      user?.email?.endsWith('@test.cashoffers.com') ||
      false

    return {
      testMode,
      userId: user?.id,
      metadata: {
        detectedFrom: this.getDetectionSource(request, user, testMode)
      }
    }
  }
}
```

#### 3.2 Create Test Mode Authorization
**File:** `src/infrastructure/payment/test-mode-authorizer.ts` (NEW)

```typescript
export interface ITestModeAuthorizer {
  authorize(user: any, testMode: boolean): void
}

export class TestModeAuthorizer implements ITestModeAuthorizer {
  authorize(user: any, testMode: boolean): void {
    if (testMode && !this.hasTestModePermission(user)) {
      throw new UnauthorizedError('Test mode requires payments_test_mode permission')
    }
  }

  private hasTestModePermission(user: any): boolean {
    return user?.permissions?.includes('payments_test_mode') || false
  }
}
```

#### 3.3 Update Auth Middleware
**File:** [src/middleware/hono/authMiddleware.ts](src/middleware/hono/authMiddleware.ts)

- Inject test mode detector and authorizer
- Detect test mode from request
- Authorize test mode usage
- Attach `PaymentContext` to Hono context variables
- Log test mode activations for audit trail

### Phase 4: Repository Updates

#### 4.1 Update Transaction Repository
**File:** [src/infrastructure/database/repositories/transaction.repository.ts](src/infrastructure/database/repositories/transaction.repository.ts)

- Add `square_environment` to `create()` method interface
- Add `findByEnvironment(environment: 'production' | 'sandbox')` method
- Add environment parameter to existing query methods (optional, defaults to all)

#### 4.2 Update UserCard Repository
**File:** [src/infrastructure/database/repositories/user-card.repository.ts](src/infrastructure/database/repositories/user-card.repository.ts)

- Add `square_environment` to `create()` and `update()` methods
- Update `findByUserId()` to optionally filter by environment
- Handle multiple cards per user (one per environment)

#### 4.3 Update Subscription Repository
**File:** [src/infrastructure/database/repositories/subscription.repository.ts](src/infrastructure/database/repositories/subscription.repository.ts)

- Add `square_environment` to `create()` and `update()` methods
- Add `findByEnvironment(environment: 'production' | 'sandbox')` method
- Update queries to optionally filter by environment

### Phase 5: Use Case Updates

Update these use cases to pass context through to providers and include environment in database operations:

**Files to update:**
- [src/use-cases/payment/create-payment.use-case.ts](src/use-cases/payment/create-payment.use-case.ts)
- [src/use-cases/payment/create-card.use-case.ts](src/use-cases/payment/create-card.use-case.ts)
- [src/use-cases/payment/refund-payment.use-case.ts](src/use-cases/payment/refund-payment.use-case.ts)
- [src/use-cases/subscription/purchase-subscription.use-case.ts](src/use-cases/subscription/purchase-subscription.use-case.ts)
- [src/use-cases/subscription/renew-subscription.use-case.ts](src/use-cases/subscription/renew-subscription.use-case.ts)

**Pattern:**
1. Add `context?: PaymentContext` to input types
2. Pass context to `paymentProvider` calls
3. Extract `environment` from payment/card results
4. Pass `square_environment` to repository `create()` calls
5. Include environment in event payloads

**Example:**
```typescript
// In create-payment.use-case.ts
const payment = await this.deps.paymentProvider.createPayment({
  sourceId: card.card_id,
  amountMoney: { amount: validatedInput.amount, currency: 'USD' },
  // ... other fields
}, validatedInput.context) // Pass context

await this.deps.transactionRepository.create({
  // ... existing fields
  square_environment: payment.environment, // Use environment from result
})
```

#### 5.1 CRITICAL: Subscription Renewal Environment Logic
**File:** [src/use-cases/subscription/renew-subscription.use-case.ts](src/use-cases/subscription/renew-subscription.use-case.ts)

**The Problem:** When a subscription renews (especially from cron), we need to determine which Square environment to use based on the subscription and card's original environment.

**The Solution:**
```typescript
async execute(input: RenewSubscriptionInput): Promise<RenewSubscriptionOutput> {
  // 1. Fetch subscription from database
  const subscription = await this.deps.subscriptionRepository.findById(input.subscriptionId)

  // 2. Fetch the card associated with the subscription
  const card = await this.deps.userCardRepository.findByUserId(subscription.user_id)

  // 3. CRITICAL: Determine environment from card and/or subscription
  const environment = card.square_environment || subscription.square_environment

  // 4. Create PaymentContext with testMode based on environment
  const context: PaymentContext = {
    testMode: environment === 'sandbox',
    source: input.source || 'CRON',
    userId: subscription.user_id,
    metadata: {
      subscriptionId: subscription.subscription_id,
      detectedEnvironment: environment
    }
  }

  // 5. Process renewal payment with correct environment
  const payment = await this.deps.paymentProvider.createPayment({
    sourceId: card.card_id,
    amountMoney: { amount: subscription.amount, currency: 'USD' },
    // ... other fields
  }, context) // Pass context with correct testMode

  // 6. Log transaction with correct environment
  await this.deps.transactionRepository.create({
    // ... existing fields
    square_environment: environment,
  })

  // Rest of renewal logic...
}
```

**Key Points:**
- Look up card's `square_environment` field
- Fall back to subscription's `square_environment` if card lookup fails
- Use environment to set `context.testMode` (sandbox = true, production = false)
- This ensures sandbox subscriptions renew with sandbox, production with production
- No manual intervention needed - automatic environment detection

#### 5.2 Subscription Creation Environment Tracking
**File:** [src/use-cases/subscription/purchase-subscription.use-case.ts](src/use-cases/subscription/purchase-subscription.use-case.ts)

When creating a subscription:
```typescript
// After creating card and processing initial payment
const subscription = await this.deps.subscriptionRepository.create({
  // ... existing fields
  square_environment: cardResult.environment, // Store environment from card creation
})
```

This ensures the subscription remembers which environment it was created in.

### Phase 6: Route Updates

#### 6.1 Update Purchase Route
**File:** [src/routes/hono/purchase.ts](src/routes/hono/purchase.ts)

- Extract `test_mode` from query parameters
- Get or create `PaymentContext` from middleware
- Pass context to `purchaseSubscription` use case
- Include environment in response metadata

**Key change:**
```typescript
app.post('/purchase', async (c) => {
  const context = c.get('paymentContext') // From middleware
  const result = await container.useCases.purchaseSubscription.execute({
    // ... existing fields
    context, // Add context
  })

  return c.json({
    ...result,
    environment: context.testMode ? 'sandbox' : 'production' // Show in response
  })
})
```

#### 6.2 Update Payment Routes
**File:** [src/routes/hono/payment.ts](src/routes/hono/payment.ts)

Similar pattern - extract context from middleware, pass to use cases, include in responses.

#### 6.3 Update Subscription Routes
**File:** [src/routes/hono/subscription.ts](src/routes/hono/subscription.ts)

Add test mode support for manual subscription operations.

#### 6.4 Update Cron Job
**File:** [src/cron/subscriptionsCron.ts](src/cron/subscriptionsCron.ts)

**CRITICAL CHANGE:** The cron job must detect and use the correct environment for each subscription (not always production).

**Implementation:**
```typescript
// For each subscription due for renewal
for (const subscription of subscriptionsDue) {
  // Fetch the card to determine environment
  const card = await userCardRepository.findByUserId(subscription.user_id)

  // Determine environment from card/subscription
  const environment = card?.square_environment || subscription.square_environment || 'production'

  // Create context with correct environment
  const context: PaymentContext = {
    testMode: environment === 'sandbox',
    source: 'CRON',
    metadata: {
      subscriptionId: subscription.subscription_id,
      detectedEnvironment: environment
    }
  }

  // Log which environment is being used
  logger.info('Processing subscription renewal', {
    subscriptionId: subscription.subscription_id,
    userId: subscription.user_id,
    environment,
    testMode: context.testMode
  })

  // Renew with detected environment
  await renewSubscriptionUseCase.execute({
    subscriptionId: subscription.subscription_id,
    context, // Pass context with correct testMode
    source: 'CRON'
  })
}
```

**Key Points:**
- Cron job does NOT force production mode
- Instead, it detects environment from card/subscription
- Sandbox subscriptions renew with sandbox
- Production subscriptions renew with production
- Extensive logging for audit trail
- Default to production only if environment cannot be determined

### Phase 7: Dependency Injection

#### 7.1 Update Container
**File:** [src/container.ts](src/container.ts)

Wire up dual environment architecture:
```typescript
export const createContainer = (): IContainer => {
  const config = createConfig()
  const logger = createLogger(...)

  // Create both providers
  const productionProvider = createSquarePaymentProvider(
    { ...config, square: config.square.production },
    logger,
    'production'
  )

  const sandboxProvider = config.square.sandbox.accessToken
    ? createSquarePaymentProvider(
        { ...config, square: config.square.sandbox },
        logger,
        'sandbox'
      )
    : null

  // Wrap in dual environment provider
  const paymentProvider = new DualEnvironmentPaymentProvider(
    productionProvider,
    sandboxProvider,
    logger
  )

  // Create test mode services
  const testModeDetector = new TestModeDetector()
  const testModeAuthorizer = new TestModeAuthorizer()

  const services = {
    payment: paymentProvider, // Use dual provider
    testModeDetector,
    testModeAuthorizer,
    // ... rest unchanged
  }

  // Rest of container setup...
}
```

### Phase 8: Event System

#### 8.1 Update Domain Events
**Files:** All events in [src/domain/events/](src/domain/events/)

Add `environment: 'production' | 'sandbox'` to event payloads:
- `payment-processed.event.ts`
- `payment-failed.event.ts`
- `card-created.event.ts`
- `subscription-created.event.ts`

#### 8.2 Update Event Handlers
**File:** [src/application/event-handlers/email-notification.handler.ts](src/application/event-handlers/email-notification.handler.ts)

- Add `[SANDBOX]` prefix to email subjects when `environment === 'sandbox'`
- Include environment disclaimer in email body for sandbox transactions

## Environment Variables

Add to `.env`:
```bash
# Production Square credentials (existing)
SQUARE_ACCESS_TOKEN=sq0atp-...
SQUARE_LOCATION_ID=L...
SQUARE_ENVIRONMENT=production

# Sandbox Square credentials (new, optional)
SQUARE_SANDBOX_ACCESS_TOKEN=sq0atp-sandbox-...
SQUARE_SANDBOX_LOCATION_ID=L...
```

## Security Considerations

1. **Permission Required**: Test mode requires `payments_test_mode` permission for manual API calls
2. **Audit Logging**: All test mode usage logged with timestamp, user ID, detection source
3. **Clear Separation**: Database queries can filter by environment
4. **Cron Environment Detection**: Automated renewals detect environment from subscription/card, ensuring consistency (sandbox subscriptions stay sandbox, production stay production)
5. **Environment Immutability**: Once a subscription is created in an environment, it always renews in that environment (no cross-environment renewals)
6. **Error Handling**: Never expose which environment in user-facing errors
7. **Reporting Separation**: Production reports should filter out sandbox data by default

## Testing Square Sandbox

Once implemented, you can test with Square's official test cards:

**Success scenarios:**
- `4111 1111 1111 1111` - Generic success
- `5105 1051 0510 5100` - Mastercard success

**Failure scenarios:**
- `4000 0000 0000 0002` - Card declined
- `4000 0000 0000 0119` - Insufficient funds
- `4242 4242 4242 4242` - Invalid expiration

Use CVV `111` and any future expiration date.

## Verification Steps

### 1. Configuration Test
```bash
# Set sandbox credentials in .env
# Start server
npm run dev
# Check logs show both environments initialized
```

### 2. Test Mode Purchase
```bash
curl -X POST "http://localhost:3000/api/purchase?test_mode=true" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "product_id": 1,
    "card_token": "cnon:card-nonce-ok"
  }'
```

### 3. Database Verification
```sql
-- Check environment recorded
SELECT transaction_id, square_transaction_id, square_environment
FROM Transactions
WHERE square_environment = 'sandbox';

SELECT id, card_id, square_environment
FROM UserCards
WHERE square_environment = 'sandbox';
```

### 4. Production Still Works
```bash
# Same request WITHOUT test_mode parameter
curl -X POST "http://localhost:3000/api/purchase" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ ... }'

# Verify uses production environment
```

### 5. Permission Enforcement
```bash
# Try test mode without permission
# Should return 401/403 error
```

### 6. Subscription Renewal Environment Consistency
```bash
# Create a sandbox subscription with test_mode=true
curl -X POST "http://localhost:3000/api/purchase?test_mode=true" ...

# Wait for renewal date or manually trigger renewal
# Check that renewal uses sandbox environment
SELECT subscription_id, square_environment FROM Subscriptions WHERE square_environment = 'sandbox';
SELECT transaction_id, type, square_environment FROM Transactions
WHERE type = 'subscription_renewal' AND square_environment = 'sandbox';

# Verify sandbox subscriptions renew with sandbox, production with production
```

### 7. Cron Job Environment Detection
```bash
# Run cron job with both sandbox and production subscriptions
npm run cron

# Check logs show environment detection
# Example log output:
# "Processing subscription renewal: subscriptionId=123, environment=sandbox, testMode=true"
# "Processing subscription renewal: subscriptionId=456, environment=production, testMode=false"

# Verify transactions created with correct environments
SELECT subscription_id, square_environment, COUNT(*)
FROM Transactions
WHERE type = 'subscription_renewal'
GROUP BY square_environment;
```

## Critical Files Summary

**New Files:**
- `src/infrastructure/payment/dual-environment-provider.ts`
- `src/infrastructure/payment/test-mode-detector.ts`
- `src/infrastructure/payment/test-mode-authorizer.ts`
- `src/database/migrations/002_add_square_environment_tracking.sql`

**Modified Files:**
- `src/config/config.interface.ts`
- `src/config/config.service.ts`
- `src/container.ts`
- `src/infrastructure/payment/payment-provider.interface.ts`
- `src/infrastructure/payment/square/square.provider.ts`
- `src/middleware/hono/authMiddleware.ts`
- `src/infrastructure/database/repositories/transaction.repository.ts`
- `src/infrastructure/database/repositories/user-card.repository.ts`
- `src/infrastructure/database/repositories/subscription.repository.ts`
- `src/use-cases/payment/*.use-case.ts` (5 files)
- `src/routes/hono/purchase.ts`
- `src/routes/hono/payment.ts`
- `src/routes/hono/subscription.ts`
- `src/cron/subscriptionsCron.ts` (CRITICAL: environment detection logic)
- `src/domain/events/*.event.ts` (multiple event files)
- `src/application/event-handlers/email-notification.handler.ts`

## Backward Compatibility

- Existing production setup works unchanged
- Sandbox credentials are optional
- `PaymentContext` is optional everywhere (defaults to production)
- No breaking changes to existing API contracts
- Test mode is opt-in only

## Implementation Timeline

- **Phase 1-2:** Foundation (config, DB, provider layer) - 2-3 hours
- **Phase 3-4:** Detection and repositories - 1-2 hours
- **Phase 5-6:** Use cases and routes - 2-3 hours
- **Phase 7-8:** Container and events - 1 hour
- **Testing & Verification:** 1-2 hours

**Total estimated time:** 7-11 hours
