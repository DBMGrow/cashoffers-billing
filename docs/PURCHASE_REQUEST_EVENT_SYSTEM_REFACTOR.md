# Implementation Plan: PurchaseRequest Tracking & Event-Based Architecture

## Context

The current billing system has purchase and renewal logic tightly coupled with side effects like user management, email notifications, and transaction logging. This makes the code harder to maintain, test, and extend. When a purchase or renewal occurs, all side effects happen synchronously within the use case, making it difficult to:

1. **Track purchase lifecycle**: No visibility into which stage a purchase is at (validation, payment, subscription creation)
2. **Debug failures**: If something fails, we can't easily see what was attempted or resume from where it failed
3. **Extend functionality**: Adding new post-purchase actions (webhooks, analytics, third-party integrations) requires modifying core business logic
4. **Handle retries**: Failed renewals use ad-hoc retry logic embedded in the use case
5. **Support webhooks**: External systems can't subscribe to subscription events

**This plan refactors the system to:**

- Track all purchase attempts in a `PurchaseRequests` table with granular status tracking
- Decouple side effects using a domain event system
- Enable webhook support for external integrations
- Make the system more maintainable, testable, and extensible

---

## Recommended Approach

### Phase 1: PurchaseRequest Tracking (Week 1)

**Goal**: Add purchase request tracking without changing existing behavior. This establishes the foundation for event-based refactoring.

#### 1.1 Database Schema

Create `PurchaseRequests` table:

```sql
CREATE TABLE PurchaseRequests (
  -- Primary identification
  request_id INT AUTO_INCREMENT PRIMARY KEY,
  request_uuid VARCHAR(36) UNIQUE NOT NULL,

  -- Request classification
  request_type ENUM('NEW_PURCHASE', 'RENEWAL', 'UPGRADE') NOT NULL,
  source ENUM('API', 'CRON', 'ADMIN') DEFAULT 'API',

  -- Core identifiers
  user_id INT NULL,
  email VARCHAR(255) NOT NULL,
  product_id INT NOT NULL,
  subscription_id INT NULL,

  -- Input data (for auditability and retry)
  request_data JSON NOT NULL,

  -- Status tracking
  status ENUM(
    'PENDING',
    'VALIDATING',
    'PROCESSING_PAYMENT',
    'CREATING_SUBSCRIPTION',
    'FINALIZING',
    'COMPLETED',
    'FAILED',
    'RETRY_SCHEDULED'
  ) DEFAULT 'PENDING',

  -- Error tracking
  failure_reason TEXT NULL,
  error_code VARCHAR(50) NULL,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at DATETIME NULL,

  -- Results (set on completion)
  subscription_id_result INT NULL,
  transaction_id_result INT NULL,
  amount_charged INT NULL,
  card_id_result VARCHAR(100) NULL,

  -- Metadata
  idempotency_key VARCHAR(100) NULL,
  user_created BOOLEAN DEFAULT FALSE,
  prorated_amount INT NULL,

  -- Audit timestamps
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  processing_duration_ms INT NULL,

  -- Indexes for performance
  INDEX idx_user_email (user_id, email),
  INDEX idx_status_retry (status, next_retry_at),
  INDEX idx_request_uuid (request_uuid),
  INDEX idx_subscription_result (subscription_id_result),
  INDEX idx_created_at (created_at),

  -- Foreign keys
  FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE RESTRICT,
  FOREIGN KEY (subscription_id) REFERENCES Subscriptions(subscription_id) ON DELETE SET NULL,
  FOREIGN KEY (subscription_id_result) REFERENCES Subscriptions(subscription_id) ON DELETE SET NULL,
  FOREIGN KEY (transaction_id_result) REFERENCES Transactions(transaction_id) ON DELETE SET NULL
);
```

**Key Design Decisions:**

- **request_uuid**: Client-provided idempotency key prevents duplicate purchases
- **request_data JSON**: Stores all input parameters for audit trail and retry capability
- **Granular statuses**: Enable resumability at any point in the workflow
- **Separate result fields**: Clear distinction between input and output
- **Built-in retry mechanism**: Supports automatic retry with exponential backoff

#### 1.2 Domain Layer

Create domain entity following existing patterns from `Subscription` entity:

**File**: `src/domain/entities/purchase-request.ts`

- Factory method: `PurchaseRequest.create()`
- Reconstitution: `PurchaseRequest.from()`
- Business methods: `markAsProcessing()`, `markAsCompleted()`, `markAsFailed()`, `scheduleRetry()`

**File**: `src/domain/value-objects/purchase-request-status.ts`

- Value object for status with validation
- Status transition rules

**File**: `src/domain/mappers/purchase-request.mapper.ts`

- `toDomain()`: Database row → Domain entity
- `toDatabase()`: Domain entity → Database row

#### 1.3 Repository Layer

**File**: `src/infrastructure/database/repositories/purchase-request.repository.interface.ts`

```typescript
interface IPurchaseRequestRepository extends IRepository<PurchaseRequest> {
  findByUuid(uuid: string): Promise<PurchaseRequest | null>
  findByStatus(status: PurchaseRequestStatus): Promise<PurchaseRequest[]>
  findDueForRetry(date: Date): Promise<PurchaseRequest[]>
  findByEmail(email: string): Promise<PurchaseRequest[]>
  findBySubscriptionId(subscriptionId: number): Promise<PurchaseRequest[]>
  markAsProcessing(id: number, trx?: TransactionContext): Promise<void>
  markAsCompleted(id: number, results: CompletionResults, trx?: TransactionContext): Promise<void>
  markAsFailed(id: number, error: string, trx?: TransactionContext): Promise<void>
}
```

**File**: `src/infrastructure/database/repositories/purchase-request.repository.ts`

- Implement using Kysely following the pattern in `subscription.repository.ts`

#### 1.4 Integrate Into Use Cases

**Modify**: `src/use-cases/subscription/purchase-subscription.use-case.ts`

```typescript
async execute(input: PurchaseSubscriptionInput): Promise<UseCaseResult<PurchaseSubscriptionOutput>> {
  // 1. Create PurchaseRequest (status: PENDING)
  const purchaseRequest = await this.deps.purchaseRequestRepository.create({
    requestUuid: input.idempotencyKey || uuidv4(),
    requestType: 'NEW_PURCHASE',
    source: 'API',
    email: input.email,
    productId: input.productId,
    requestData: JSON.stringify(input),
    status: 'PENDING',
  })

  try {
    // 2. Validate (status: VALIDATING)
    await this.deps.purchaseRequestRepository.update(purchaseRequest.request_id, {
      status: 'VALIDATING',
      started_at: new Date()
    })

    // Existing validation logic...

    // 3. Process payment (status: PROCESSING_PAYMENT)
    await this.deps.purchaseRequestRepository.update(purchaseRequest.request_id, {
      status: 'PROCESSING_PAYMENT'
    })

    // Existing payment logic...

    // 4. Create subscription (status: CREATING_SUBSCRIPTION)
    await this.deps.purchaseRequestRepository.update(purchaseRequest.request_id, {
      status: 'CREATING_SUBSCRIPTION'
    })

    // Existing subscription creation...

    // 5. Finalize (status: FINALIZING)
    await this.deps.purchaseRequestRepository.update(purchaseRequest.request_id, {
      status: 'FINALIZING'
    })

    // Existing email/activation logic...

    // 6. Mark complete (status: COMPLETED)
    await this.deps.purchaseRequestRepository.update(purchaseRequest.request_id, {
      status: 'COMPLETED',
      subscription_id_result: subscription.subscription_id,
      transaction_id_result: transaction.transaction_id,
      amount_charged: initialAmount,
      completed_at: new Date(),
      processing_duration_ms: Date.now() - startTime
    })

    return success(...)
  } catch (error) {
    // Mark as failed
    await this.deps.purchaseRequestRepository.update(purchaseRequest.request_id, {
      status: 'FAILED',
      failure_reason: error.message,
      error_code: 'PURCHASE_ERROR'
    })

    return failure(...)
  }
}
```

**Modify**: `src/use-cases/subscription/renew-subscription.use-case.ts`

- Similar integration pattern
- Create PurchaseRequest with `request_type: 'RENEWAL'` and `source: 'CRON'`
- Track status through renewal workflow
- **Hybrid retry approach**: Keep existing retry logic (`calculateNextRetryAttempt`) for backward compatibility during transition. PurchaseRequest tracks attempts but doesn't replace existing retry mechanism yet.

**Modify**: `src/cron/subscriptionsCron.ts`

- Each renewal should create a PurchaseRequest before calling `RenewSubscriptionUseCase`

**Register in Container**: `src/container.ts`

- Add `purchaseRequest: IPurchaseRequestRepository` to repositories
- Add to use case dependencies

#### 1.5 Run Kysely Codegen

After creating the table:

```bash
npm run codegen
```

This generates TypeScript types in `src/lib/db.d.ts` for the new table.

---

### Phase 2: Simple Event Bus (Week 2)

**Goal**: Decouple side effects using an in-memory event bus. This makes the system more testable and extensible without adding external dependencies.

#### 2.1 Event Infrastructure

**File**: `src/infrastructure/events/event-bus.interface.ts`

```typescript
interface IDomainEvent {
  eventId: string
  eventType: string
  occurredAt: Date
  aggregateId: string | number
  aggregateType: string
  payload: Record<string, unknown>
  metadata?: Record<string, unknown>
}

interface IEventBus {
  publish(event: IDomainEvent): Promise<void>
  publishBatch(events: IDomainEvent[]): Promise<void>
  subscribe<T extends IDomainEvent>(eventType: string, handler: IEventHandler<T>): void
}

interface IEventHandler<T extends IDomainEvent> {
  handle(event: T): Promise<void>
}
```

**File**: `src/infrastructure/events/in-memory-event-bus.ts`

- Simple implementation using Map<eventType, handlers[]>
- Synchronous handler execution with error catching
- Log errors for non-critical handlers (emails)
- Throw errors for critical handlers (transaction logging)

**File**: `src/infrastructure/events/base-event-handler.ts`

- Abstract base class for handlers
- Built-in error handling and logging

#### 2.2 Domain Events

Create event classes in `src/domain/events/`:

- `subscription-created.event.ts`: Published when subscription is created
- `subscription-renewed.event.ts`: Published when subscription is renewed
- `payment-processed.event.ts`: Published after successful payment
- `payment-failed.event.ts`: Published when payment fails
- `user-created.event.ts`: Published when new user is created
- `card-created.event.ts`: Published when card is created
- `purchase-request-completed.event.ts`: Published when purchase completes
- `purchase-request-failed.event.ts`: Published when purchase fails

Each event includes relevant data in the payload (userId, subscriptionId, amount, etc.)

#### 2.3 Event Handlers

**File**: `src/application/event-handlers/email-notification.handler.ts`

```typescript
class EmailNotificationHandler implements IEventHandler<SubscriptionCreatedEvent> {
  constructor(
    private emailService: IEmailService,
    private logger: ILogger
  ) {}

  async handle(event: SubscriptionCreatedEvent): Promise<void> {
    try {
      await this.emailService.sendEmail({
        to: event.payload.email,
        subject: "Welcome to CashOffers!",
        template: "subscriptionCreated.html",
        fields: { ... }
      })
    } catch (error) {
      // Non-critical - log but don't throw
      this.logger.warn('Failed to send email', { error, event })
    }
  }
}
```

**File**: `src/application/event-handlers/transaction-logging.handler.ts`

- Critical handler - must succeed
- Logs successful payments to Transaction table

**File**: `src/application/event-handlers/premium-activation.handler.ts`

- Activates user premium status via UserApiClient
- Critical but retryable

#### 2.4 Integrate Into Use Cases

**Modify**: `src/use-cases/subscription/purchase-subscription.use-case.ts`

Replace direct calls with event publishing:

```typescript
// Before:
await this.deps.userApiClient.activateUserPremium(userId)
await this.deps.emailService.sendEmail(...)

// After:
await this.deps.eventBus.publish(new SubscriptionCreatedEvent({
  subscriptionId: subscription.subscription_id,
  userId,
  email,
  amount: initialAmount,
  productName: product.product_name
}))
```

**Register in Container**: `src/container.ts`

```typescript
// Create event bus
const eventBus = new InMemoryEventBus(logger)

// Register handlers
eventBus.subscribe('SubscriptionCreated', new EmailNotificationHandler(services.email, logger))
eventBus.subscribe('SubscriptionCreated', new PremiumActivationHandler(services.userApi, logger))
eventBus.subscribe('PaymentProcessed', new TransactionLoggingHandler(repositories.transaction, logger))

// Add to container
services: {
  ...
  eventBus
}
```

---

### Phase 3: Transactional Outbox (Week 3)

**Goal**: Guarantee event delivery with at-least-once semantics using the transactional outbox pattern. This ensures events are never lost, even if the process crashes.

#### 3.1 Event Outbox Table

```sql
CREATE TABLE BillingEventOutbox (
  outbox_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_id VARCHAR(36) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  aggregate_type VARCHAR(50) NOT NULL,
  aggregate_id VARCHAR(100) NOT NULL,
  payload JSON NOT NULL,
  metadata JSON NULL,

  status ENUM('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED') DEFAULT 'PENDING',
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 5,
  next_retry_at DATETIME NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME NULL,

  INDEX idx_status_retry (status, next_retry_at),
  INDEX idx_event_type (event_type),
  INDEX idx_aggregate (aggregate_type, aggregate_id)
);
```

#### 3.2 Outbox Repository

**File**: `src/infrastructure/database/repositories/event-outbox.repository.ts`

- `create()`: Insert events into outbox
- `findPending()`: Get events ready to process
- `markAsPublished()`: Update status after successful delivery
- `markAsFailed()`: Update status after failure

#### 3.3 Outbox Event Bus

**File**: `src/infrastructure/events/outbox-event-bus.ts`

```typescript
class OutboxEventBus implements IEventBus {
  async publish(event: IDomainEvent): Promise<void> {
    // Write to EventOutbox instead of publishing directly
    // This happens within the use case's transaction
    await this.outboxRepository.create({
      event_id: event.eventId,
      event_type: event.eventType,
      aggregate_type: event.aggregateType,
      aggregate_id: event.aggregateId,
      payload: event.payload,
      status: "PENDING",
    })
  }
}
```

#### 3.4 Outbox Processor

**File**: `src/infrastructure/events/event-outbox-processor.ts`

- Background worker that polls EventOutbox for PENDING events
- Publishes events to registered handlers
- Updates status to PUBLISHED on success
- Implements retry logic with exponential backoff on failure

**File**: `src/cron/eventOutboxProcessor.ts`

- Entry point for outbox processing
- Can be triggered by cron or run continuously

#### 3.5 Update Container

**Modify**: `src/container.ts`

- Swap `InMemoryEventBus` for `OutboxEventBus`
- Start `EventOutboxProcessor` on app startup

---

### Phase 4: Webhook Support (Week 4)

**Goal**: Allow external systems to subscribe to subscription events via webhooks.

#### 4.1 Webhook Subscriptions Table

```sql
CREATE TABLE BillingWebhookSubscriptions (
  webhook_id INT AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(500) NOT NULL,
  secret VARCHAR(100) NOT NULL,
  event_types JSON NOT NULL,
  status ENUM('ACTIVE', 'PAUSED', 'DISABLED') DEFAULT 'ACTIVE',

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_status (status)
);
```

#### 4.2 Webhook Delivery Handler

**File**: `src/infrastructure/webhooks/webhook-delivery.handler.ts`

- Listens to all domain events
- Looks up active webhook subscriptions
- POSTs event data to webhook URLs
- Signs payload with HMAC for security
- Implements retry logic

**File**: `src/infrastructure/webhooks/webhook-signature.ts`

- HMAC signature generation/verification

#### 4.3 Webhook Management Routes

**File**: `src/routes/hono/webhooks.ts`

- POST /webhooks - Create subscription
- GET /webhooks - List subscriptions
- DELETE /webhooks/:id - Delete subscription
- POST /webhooks/:id/pause - Pause delivery
- POST /webhooks/:id/resume - Resume delivery

#### 4.4 Register Webhook Handler

**Modify**: `src/container.ts`

- Create `WebhookDeliveryHandler`
- Subscribe to all event types: `eventBus.subscribe('*', webhookHandler)`

---

## Critical Files to Modify

### Phase 1

- **NEW**: `src/database/migrations/001_create_purchase_requests.sql`
- **NEW**: `src/domain/entities/purchase-request.ts`
- **NEW**: `src/domain/value-objects/purchase-request-status.ts`
- **NEW**: `src/domain/mappers/purchase-request.mapper.ts`
- **NEW**: `src/infrastructure/database/repositories/purchase-request.repository.interface.ts`
- **NEW**: `src/infrastructure/database/repositories/purchase-request.repository.ts`
- **MODIFY**: `src/use-cases/subscription/purchase-subscription.use-case.ts`
- **MODIFY**: `src/use-cases/subscription/renew-subscription.use-case.ts`
- **MODIFY**: `src/cron/subscriptionsCron.ts`
- **MODIFY**: `src/container.ts`

### Phase 2

- **NEW**: `src/infrastructure/events/event-bus.interface.ts`
- **NEW**: `src/infrastructure/events/in-memory-event-bus.ts`
- **NEW**: `src/infrastructure/events/base-event-handler.ts`
- **NEW**: `src/domain/events/` (multiple event classes)
- **NEW**: `src/application/event-handlers/` (multiple handler classes)
- **MODIFY**: `src/use-cases/subscription/purchase-subscription.use-case.ts`
- **MODIFY**: `src/use-cases/subscription/renew-subscription.use-case.ts`
- **MODIFY**: `src/container.ts`

### Phase 3

- **NEW**: `src/database/migrations/002_create_event_outbox.sql`
- **NEW**: `src/infrastructure/database/repositories/event-outbox.repository.ts`
- **NEW**: `src/infrastructure/events/outbox-event-bus.ts`
- **NEW**: `src/infrastructure/events/event-outbox-processor.ts`
- **NEW**: `src/cron/eventOutboxProcessor.ts`
- **MODIFY**: `src/container.ts`

### Phase 4

- **NEW**: `src/database/migrations/003_create_webhook_subscriptions.sql`
- **NEW**: `src/infrastructure/webhooks/webhook-delivery.handler.ts`
- **NEW**: `src/infrastructure/webhooks/webhook-signature.ts`
- **NEW**: `src/routes/hono/webhooks.ts`
- **NEW**: `src/use-cases/webhook/create-webhook-subscription.use-case.ts`
- **MODIFY**: `src/container.ts`

---

## Design Trade-offs

### PurchaseRequest Created Before Payment

✅ **Chosen approach**: Create PurchaseRequest in PENDING status before payment attempt

**Rationale**:

- Full audit trail of all purchase attempts
- Idempotency via `request_uuid` prevents duplicate charges
- Can resume from any failure point
- Better debugging and monitoring

**Alternative**: Create PurchaseRequest after successful payment

- Simpler but loses visibility into failed attempts

### Event System: In-Memory → Outbox → Queue

✅ **Chosen approach**: Start simple (in-memory), evolve to reliable (outbox)

**Rationale**:

- Phase 1 proves the architecture without external dependencies
- Phase 2 adds reliability when needed
- Can skip directly to Phase 2 if reliability is critical from day one

**Alternative**: Start with message queue (BullMQ/Redis)

- More complex, requires Redis infrastructure
- Overkill for current scale

### Transaction Boundaries

✅ **Chosen approach**: Critical operations in transaction, side effects async

**Pattern**:

```typescript
await transactionManager.runInTransaction(async (trx) => {
  // Critical: Payment + Subscription + Transaction log + Event outbox
  await paymentProvider.createPayment(...)
  await subscriptionRepo.create(..., trx)
  await transactionRepo.create(..., trx)
  await eventOutboxRepo.create(events, trx)
})

// After commit: Event processor handles emails, webhooks, etc.
```

**Rationale**:

- Atomicity for financial operations
- Side effects (emails, webhooks) are eventually consistent
- Email failure doesn't fail the purchase

---

## Verification Steps

### Phase 1: PurchaseRequest Tracking

1. **Test new purchase**:

   ```bash
   curl -X POST http://localhost:8000/purchase \
     -H "Content-Type: application/json" \
     -d '{"product_id": 1, "email": "test@example.com", ...}'
   ```

   - Verify PurchaseRequest created with status transitions
   - Check `request_uuid` for idempotency
   - Verify results populated on completion

2. **Test renewal via cron**:

   ```bash
   npm run cron:subscriptions
   ```

   - Verify PurchaseRequest created with `request_type: RENEWAL`, `source: CRON`
   - Check status tracking through renewal flow

3. **Test failure handling**:
   - Trigger payment failure (invalid card)
   - Verify PurchaseRequest status = FAILED
   - Check `failure_reason` and `error_code` populated

4. **Query audit trail**:
   ```sql
   SELECT * FROM PurchaseRequests
   WHERE email = 'test@example.com'
   ORDER BY created_at DESC;
   ```

### Phase 2: Event System

1. **Test event publishing**:
   - Make purchase
   - Check logs for event publications
   - Verify handlers executed (email sent, transaction logged)

2. **Test email failure resilience**:
   - Mock email service to throw error
   - Verify purchase still succeeds
   - Check warning logged

3. **Run unit tests**:
   ```bash
   npm test
   ```

### Phase 3: Transactional Outbox

1. **Test outbox persistence**:
   - Make purchase
   - Check EventOutbox table has PENDING events
   - Run outbox processor
   - Verify events marked as PUBLISHED

2. **Test process crash recovery**:
   - Stop app after purchase but before outbox processing
   - Restart app
   - Verify outbox processor picks up pending events

3. **Test retry logic**:
   - Mock handler to fail
   - Verify retry_count increments
   - Check next_retry_at updated with exponential backoff

### Phase 4: Webhooks

1. **Create webhook subscription**:

   ```bash
   curl -X POST http://localhost:8000/webhooks \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com/webhook", "event_types": ["SubscriptionCreated"]}'
   ```

2. **Test webhook delivery**:
   - Make purchase
   - Verify webhook POST sent to subscribed URL
   - Check HMAC signature in headers

3. **Test webhook retry**:
   - Configure webhook URL to return 500
   - Verify retries with exponential backoff
   - Check webhook delivery logs

---

## Rollback Strategy

### Phase 1

- PurchaseRequest table is additive - doesn't break existing code
- Can be rolled back by reverting use case changes
- Data preserved for audit trail

### Phase 2

- Event system is parallel to existing code
- Can disable by removing event publishing from use cases
- Existing synchronous calls still work

### Phase 3

- Can roll back to in-memory event bus
- Outbox table remains for audit

### Phase 4

- Webhooks are optional feature
- Can be disabled without affecting core functionality

---

## Existing Patterns to Follow

1. **Use Case Pattern**: Constructor DI with `Dependencies` interface
2. **Result Pattern**: `UseCaseResult<T>` with `success()` / `failure()` helpers
3. **Validation**: Zod schemas (create `PurchaseRequestInputSchema`)
4. **Repository Pattern**: Kysely-based with optional `trx` parameter
5. **Domain Entities**: Factory methods (`create()`, `from()`) + mappers
6. **Transaction Manager**: Use `transactionManager.runInTransaction(async (trx) => ...)`
7. **Container Registration**: Add new dependencies to `IContainer` interface and `createContainer()`

---

## Implementation Decisions

Based on your requirements:

1. ✅ **Scope**: All 4 phases (complete refactor with webhooks)
2. ✅ **Event System**: Start with in-memory (Phase 2), evolve to outbox (Phase 3)
3. ✅ **Retry Logic**: Hybrid approach
   - New purchases: Use PurchaseRequest retry mechanism
   - Renewals: Keep existing `calculateNextRetryAttempt` logic during transition
   - PurchaseRequest tracks all attempts for audit trail
   - This maintains backward compatibility while adding new capabilities

## Timeline Estimate

- **Phase 1**: 5 days (PurchaseRequest tracking)
- **Phase 2**: 5 days (Event bus + handlers)
- **Phase 3**: 5 days (Transactional outbox)
- **Phase 4**: 5 days (Webhooks)

**Total**: ~4 weeks for complete implementation

Each phase will be delivered incrementally with full testing before moving to the next phase.
