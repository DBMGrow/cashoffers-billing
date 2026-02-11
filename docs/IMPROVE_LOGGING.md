# Production Database Logging System Implementation Plan

## Context

The billing service currently uses structured logging that outputs to console (JSON in production, readable format in development). We need to **persist all logs to a database table** for production monitoring, debugging, and audit trails.

**Key Requirements:**
- Save logs to a new `BillingLogs` database table
- During HTTP requests: Queue logs in memory, insert after response sent (no request latency impact)
- During cron/background jobs: Log immediately to database
- Integrate seamlessly with existing ILogger interface - no changes to use case code

**Why this approach:** Queuing logs during requests prevents database I/O from slowing down API responses. Background jobs need immediate logging since there's no "end of request" to flush at.

## Architecture Overview

The solution uses a **decorator pattern** to wrap the existing `StructuredLogger` with database persistence, combined with **AsyncLocalStorage** for automatic request context detection and **event bus** for post-response log flushing.

### Design Decisions

1. **Context Detection**: Use Node's `AsyncLocalStorage` to automatically detect if code is running in a request context
2. **Log Queueing**: Store queued logs in AsyncLocalStorage per request (in-memory array)
3. **Flushing Strategy**: Use event bus with a new `RequestCompletedEvent` triggered by middleware after response
4. **Logger Implementation**: Create `DatabaseLogger` that wraps `StructuredLogger` and adds database persistence
5. **Zero Breaking Changes**: All existing code continues to work unchanged

## Database Schema

### BillingLogs Table

**Migration file**: [api/database/migrations/004_create_billing_logs.sql](api/database/migrations/004_create_billing_logs.sql)

```sql
CREATE TABLE IF NOT EXISTS BillingLogs (
  log_id BIGINT AUTO_INCREMENT PRIMARY KEY,

  -- Log classification
  level ENUM('debug', 'info', 'warn', 'error') NOT NULL,
  message TEXT NOT NULL,

  -- Request context (nullable - not all logs are from requests)
  request_id VARCHAR(36) NULL,
  user_id INT NULL,

  -- Component identification
  component VARCHAR(100) NULL COMMENT 'Logger context component name',
  service VARCHAR(50) DEFAULT 'cashoffers-billing',

  -- Context type for filtering
  context_type ENUM('http_request', 'cron_job', 'event_handler', 'background') NOT NULL,

  -- Flexible metadata storage
  metadata JSON NULL COMMENT 'Structured metadata from log entry',
  error_stack TEXT NULL COMMENT 'Stack trace for error logs',

  -- Timestamps
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Performance indexes
  INDEX idx_level_created (level, createdAt),
  INDEX idx_request_id (request_id),
  INDEX idx_user_id (user_id),
  INDEX idx_context_type (context_type),
  INDEX idx_component (component),
  INDEX idx_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**After creating migration:**
1. Run SQL migration manually on database
2. Run `npm run codegen` to regenerate Kysely types

## Implementation Components

### 1. Repository Layer

**Files to create:**
- [api/infrastructure/database/repositories/billing-log.repository.interface.ts](api/infrastructure/database/repositories/billing-log.repository.interface.ts)
- [api/infrastructure/database/repositories/billing-log.repository.ts](api/infrastructure/database/repositories/billing-log.repository.ts)

**Key methods:**
- `create(log)` - Insert single log entry
- `createMany(logs)` - Bulk insert for flushing queued logs (critical for performance)
- `findByRequestId(requestId)` - Retrieve all logs for a request
- `findByDateRange(start, end, filters)` - Query logs with filtering

**Pattern:** Follows existing repository pattern seen in [transaction.repository.ts](api/infrastructure/database/repositories/transaction.repository.ts)

### 2. Logging Context Types

**File to create:** [api/infrastructure/logging/logging-context.interface.ts](api/infrastructure/logging/logging-context.interface.ts)

Defines:
- `LogContextType` - Where the log originated ('http_request' | 'cron_job' | 'event_handler' | 'background')
- `LogQueueEntry` - Structure for queued logs before database insertion
- `LoggingContext` - Request-scoped context stored in AsyncLocalStorage

### 3. Database Logger Implementation

**File to create:** [api/infrastructure/logging/database.logger.ts](api/infrastructure/logging/database.logger.ts)

**Key behavior:**
- Wraps existing `StructuredLogger` (decorator pattern) - all logs still go to console
- Checks `AsyncLocalStorage` to detect request context
- If in HTTP request context: Queue log in memory
- If in cron/background context: Write immediately to database
- Implements `flushQueuedLogs()` method called by event handler
- Error handling: Database failures don't break the application

**Critical design point:** The logger is created once in the container but accesses AsyncLocalStorage on each log call to determine context dynamically.

### 4. AsyncLocalStorage Store

**File to create:** [api/infrastructure/logging/logging-context-store.ts](api/infrastructure/logging/logging-context-store.ts)

Provides:
- `loggingContextStore` - AsyncLocalStorage instance
- `getLoggingContext()` - Get current context or null
- `setLoggingContext(context)` - Set context for current async flow
- `withLoggingContext(context, fn)` - Execute function with context

### 5. Middleware

**Files to create:**
- [api/middleware/loggingContextMiddleware.ts](api/middleware/loggingContextMiddleware.ts) - Sets up AsyncLocalStorage context
- [api/middleware/loggingFlushMiddleware.ts](api/middleware/loggingFlushMiddleware.ts) - Publishes flush event after response

**Middleware flow:**
1. `loggingContextMiddleware` runs early: Creates LoggingContext with requestId, empty queue, stores in AsyncLocalStorage
2. Request processing: All logger calls automatically queue to AsyncLocalStorage context
3. `loggingFlushMiddleware` runs after response: Uses `setImmediate()` to publish RequestCompletedEvent without blocking

**Critical:** Must register early in middleware chain (after `digestMiddleware` which creates requestId)

### 6. Auth Middleware Enhancement

**File to modify:** [api/middleware/authMiddleware.ts](api/middleware/authMiddleware.ts)

**Change:** After setting user context (~line 108), also update AsyncLocalStorage:
```typescript
const loggingContext = getLoggingContext()
if (loggingContext) {
  loggingContext.userId = tokenOwner.user_id
}
```

This ensures userId is captured in logs for authenticated requests.

### 7. Event and Event Handler

**Files to create:**
- [api/domain/events/request-completed.event.ts](api/domain/events/request-completed.event.ts)
- [api/application/event-handlers/log-flush.handler.ts](api/application/event-handlers/log-flush.handler.ts)

**Event handler:** Receives `RequestCompletedEvent`, extracts LoggingContext from payload, calls `databaseLogger.flushQueuedLogs(context)`. Uses `safeExecute()` (non-critical handler pattern from [transaction-logging.handler.ts](api/application/event-handlers/transaction-logging.handler.ts)).

### 8. Container Integration

**File to modify:** [api/container.ts](api/container.ts)

**Changes:**
1. Import billing log repository and DatabaseLogger
2. Add `billingLog` repository to repositories object
3. Wrap base logger with DatabaseLogger before passing to use cases
4. Create and register LogFlushHandler
5. Update IContainer interface to include billingLog repository

**Critical:** Container creates DatabaseLogger once, but it dynamically checks AsyncLocalStorage on each log call.

### 9. App.ts Integration

**File to modify:** [api/app.ts](api/app.ts)

**Middleware registration order** (order matters!):
```typescript
app.use("*", honoLogger())              // Hono's built-in logger
app.use("*", cors())                    // CORS
app.use("*", digestMiddleware)          // Creates requestId (MUST BE BEFORE loggingContextMiddleware)
app.use("*", loggingContextMiddleware)  // Sets up AsyncLocalStorage (MUST BE EARLY)
app.use("*", loggingFlushMiddleware)    // Registers post-response flush (MUST BE EARLY)
```

Routes are registered after middleware, so all route handlers automatically get logging context.

### 10. Cron Job Integration

**File to modify:** [api/cron/subscriptionsCron.ts](api/cron/subscriptionsCron.ts)

**Changes:**
1. Create child logger with cron context: `const cronLogger = container.logger.child({ component: 'subscriptionsCron', contextType: 'cron_job' })`
2. Replace all `console.log/error` with `cronLogger.info/error`
3. Since cron runs outside AsyncLocalStorage context, logs are automatically written immediately to database

### 11. Hono Types Enhancement

**File to modify:** [api/types/hono.ts](api/types/hono.ts)

**Change:** Add LoggingContext to HonoVariables (optional - for explicit access if needed):
```typescript
export type HonoVariables = {
  user: any
  token_owner: any
  requestId: string
  paymentContext: PaymentContext
  loggingContext?: LoggingContext // Optional - primarily accessed via AsyncLocalStorage
}
```

## Implementation Sequence

### Phase 1: Database Foundation (No Breaking Changes)
1. ✅ Create `004_create_billing_logs.sql` migration
2. ✅ Run SQL migration on database
3. ✅ Run `npm run codegen` to generate Kysely types
4. ✅ Create `billing-log.repository.interface.ts`
5. ✅ Create `billing-log.repository.ts` with bulk insert support
6. ✅ Add repository to container (non-breaking - not used yet)

### Phase 2: Logger Infrastructure (No Breaking Changes)
1. ✅ Create `logging-context.interface.ts` (types only)
2. ✅ Create `logging-context-store.ts` (AsyncLocalStorage setup)
3. ✅ Create `database.logger.ts` (decorator wrapper)
4. ✅ Create `request-completed.event.ts`
5. ✅ Create `log-flush.handler.ts`
6. ✅ Unit test DatabaseLogger with mock AsyncLocalStorage

### Phase 3: Request Context Integration (Breaking Changes)
1. ✅ Create `loggingContextMiddleware.ts`
2. ✅ Create `loggingFlushMiddleware.ts`
3. ✅ Update `api/types/hono.ts` (optional)
4. ✅ Update `api/middleware/authMiddleware.ts` to set userId
5. ✅ Update `api/container.ts` to wire DatabaseLogger and event handler
6. ✅ Update `api/app.ts` to register middleware
7. ✅ Test: Verify logs are queued during requests and flushed after

### Phase 4: Cron Integration (Non-Breaking Enhancement)
1. ✅ Update `api/cron/subscriptionsCron.ts` to use logger
2. ✅ Test: Verify cron logs are written immediately to database

### Phase 5: Testing and Verification
1. ✅ Test HTTP request: Logs queued, no latency impact
2. ✅ Test HTTP request: Logs flushed after response with correct requestId
3. ✅ Test cron job: Logs written immediately with 'cron_job' context_type
4. ✅ Test error scenarios: Database unavailable doesn't crash app
5. ✅ Test child loggers: Context propagates correctly
6. ✅ Query BillingLogs table: Verify data structure and indexes

## Key Patterns Leveraged

1. **Repository Pattern**: [transaction.repository.ts](api/infrastructure/database/repositories/transaction.repository.ts) - interface + implementation + factory
2. **Event-Driven Architecture**: [transaction-logging.handler.ts](api/application/event-handlers/transaction-logging.handler.ts) - post-response operations
3. **Decorator Pattern**: Wraps existing StructuredLogger without replacing it
4. **Dependency Injection**: [container.ts](api/container.ts) - centralized wiring
5. **Middleware Pattern**: [digestMiddleware.ts](api/middleware/digestMiddleware.ts) - simple Hono middleware

## Performance and Safety Considerations

**Zero Request Latency:**
- Logs queued in memory (array push - microseconds)
- Flush happens via `setImmediate()` after response sent
- Bulk insert uses single SQL query with multiple VALUES

**Graceful Degradation:**
- Database logging failures logged to console, don't crash app
- Existing console logging continues to work
- No impact if database is unavailable

**Migration Safety:**
- Backward compatible - existing code unchanged
- Can be disabled by not registering middleware
- Console logs still work as fallback

## Critical Files

**Database:**
- `api/database/migrations/004_create_billing_logs.sql` - Schema definition
- `api/infrastructure/database/repositories/billing-log.repository.ts` - Database operations

**Logging Core:**
- `api/infrastructure/logging/logging-context-store.ts` - AsyncLocalStorage setup
- `api/infrastructure/logging/database.logger.ts` - Queue/flush logic

**Integration:**
- `api/container.ts` - Dependency injection wiring
- `api/app.ts` - Middleware registration
- `api/middleware/loggingContextMiddleware.ts` - Context setup
- `api/middleware/loggingFlushMiddleware.ts` - Post-response flush

**Event System:**
- `api/domain/events/request-completed.event.ts` - Flush trigger
- `api/application/event-handlers/log-flush.handler.ts` - Flush handler

## Verification Steps

After implementation:

1. **Test HTTP request logging:**
   ```bash
   npm run dev
   curl http://localhost:3000/api/v1/products  # Make request
   mysql> SELECT * FROM BillingLogs WHERE context_type = 'http_request' ORDER BY createdAt DESC LIMIT 10;
   ```

2. **Test cron job logging:**
   ```bash
   node -e "require('./api/cron/subscriptionsCron.js').default()"
   mysql> SELECT * FROM BillingLogs WHERE context_type = 'cron_job' ORDER BY createdAt DESC LIMIT 10;
   ```

3. **Verify request tracing:**
   ```bash
   mysql> SELECT message, level, createdAt FROM BillingLogs WHERE request_id = '<some-uuid>' ORDER BY createdAt;
   # Should show all logs from a single request in order
   ```

4. **Check performance:**
   - Monitor response times before/after
   - Verify no increase in p95/p99 latency
   - Confirm bulk inserts use single query

5. **Test error handling:**
   - Stop MySQL temporarily
   - Make requests - should still work, logs go to console
   - Restart MySQL - logging resumes
