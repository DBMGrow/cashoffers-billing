# Critical Alerts Integration Guide

This guide shows you how to integrate critical error alerting into existing code.

## Quick Start

### 1. Get the Alert Service

```typescript
import { getContainer } from '@/container'

const container = getContainer()
const criticalAlert = container.services.criticalAlert
```

### 2. Wrap Critical Operations

```typescript
try {
  // Your critical operation
  await someOperation()
} catch (error) {
  // Send alert
  await criticalAlert.alertCriticalError('Operation Failed', error, {
    operation: 'someOperation',
    userId: 123,
  })

  // Re-throw or handle
  throw error
}
```

## Integration Examples

### Example 1: Payment Provider (Square API)

```typescript
// In api/infrastructure/payment/square/square.provider.ts

async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult> {
  const container = getContainer()
  const criticalAlert = container.services.criticalAlert

  try {
    const response = await this.client.paymentsApi.createPayment({
      sourceId: request.cardId,
      amountMoney: {
        amount: BigInt(request.amount),
        currency: 'USD',
      },
      idempotencyKey: request.idempotencyKey,
      locationId: this.locationId,
    })

    return {
      success: true,
      transactionId: response.result.payment?.id || '',
      amount: request.amount,
    }
  } catch (error: any) {
    // Alert on Square API failures
    await criticalAlert.alertSquareApiFailure(error, {
      operation: 'createPayment',
      amount: request.amount,
      cardId: request.cardId,
    })

    this.logger.error('Square payment failed', error)
    return {
      success: false,
      error: error.message,
    }
  }
}
```

### Example 2: Database Operations

```typescript
// In a repository method

async findById(id: number): Promise<Selectable<Subscriptions> | undefined> {
  const container = getContainer()
  const criticalAlert = container.services.criticalAlert

  try {
    return await this.db
      .selectFrom('Subscriptions')
      .selectAll()
      .where('subscription_id', '=', id)
      .executeTakeFirst()
  } catch (error: any) {
    // Alert on database errors
    await criticalAlert.alertDatabaseError(error, {
      operation: 'findById',
      table: 'Subscriptions',
      id,
    })

    throw error
  }
}
```

### Example 3: External API Calls (Main API)

```typescript
// In api/infrastructure/external-api/user-api/user-api.client.ts

async getUser(userId: number): Promise<User> {
  const container = getContainer()
  const criticalAlert = container.services.criticalAlert

  try {
    const response = await fetch(`${this.config.api.url}/users/${userId}`, {
      headers: {
        'x-api-token': this.config.api.masterToken,
      },
    })

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`)
    }

    return await response.json()
  } catch (error: any) {
    // Alert on main API failures
    await criticalAlert.alertMainApiFailure(error, {
      operation: 'getUser',
      userId,
    })

    throw error
  }
}
```

### Example 4: Cron Jobs

```typescript
// In api/cron/subscriptionsCron.ts

export default async function subscriptionsCron() {
  const container = getContainer()
  const criticalAlert = container.services.criticalAlert

  try {
    // ... cron logic ...
  } catch (error: any) {
    // Alert on cron failures
    await criticalAlert.alertCronJobFailure('subscriptionsCron', error, {
      subscriptionsProcessed: count,
      failedCount: failures,
    })

    throw error
  }
}
```

### Example 5: Payment Processing in Use Cases

```typescript
// In api/use-cases/payment/create-payment.use-case.ts

async execute(request: CreatePaymentRequest): Promise<CreatePaymentResult> {
  const container = getContainer()
  const criticalAlert = container.services.criticalAlert

  try {
    // Create payment
    const result = await this.paymentProvider.createPayment(request)

    if (!result.success) {
      // Non-critical payment failure (will retry)
      this.logger.warn('Payment failed', { error: result.error })
      return result
    }

    return result
  } catch (error: any) {
    // Critical error in payment processing logic
    await criticalAlert.alertPaymentProcessingError(error, {
      userId: request.userId,
      amount: request.amount,
      operation: 'createPayment',
    })

    throw error
  }
}
```

## When to Alert

### ✅ DO Alert On These

1. **External Service Failures**
   - Square API down or erroring
   - Main API unreachable
   - SendGrid failures

2. **Infrastructure Issues**
   - Database connection failures
   - Connection pool exhausted
   - Network timeouts

3. **Data Integrity Issues**
   - Unexpected null values in critical fields
   - Failed transactions with successful payments
   - Mismatched amounts

4. **Security Issues**
   - Authentication failures (system-level)
   - Unauthorized access attempts
   - Token validation failures

5. **Business Logic Failures**
   - Cron job complete failure
   - Batch processing errors
   - Unable to process queued items

### ❌ DON'T Alert On These

1. **User Errors**
   - Invalid input
   - Validation failures
   - User authentication failures (login attempts)

2. **Expected Failures**
   - Card declined (normal)
   - Insufficient funds
   - Expired cards

3. **Recoverable Errors**
   - Failed with automatic retry
   - Temporary rate limits
   - Handled errors with fallbacks

4. **Low-Severity Issues**
   - Debug/info logs
   - Performance warnings
   - Non-critical validation issues

## Best Practices

### 1. Provide Context

Always include relevant context in the alert:

```typescript
await criticalAlert.alertSquareApiFailure(error, {
  userId: 123,
  subscriptionId: 456,
  amount: 2500,
  environment: 'production',
  retryAttempt: 3,
})
```

### 2. Use Specific Alert Methods

Use the most specific alert method available:

```typescript
// ❌ Too generic
await criticalAlert.alertCriticalError('API Error', error)

// ✅ Specific and actionable
await criticalAlert.alertMainApiFailure(error, { operation: 'getUser' })
```

### 3. Alert THEN Log

Always alert before logging or throwing:

```typescript
try {
  await operation()
} catch (error) {
  await criticalAlert.alertDatabaseError(error, context) // Alert first
  this.logger.error('Database error', error)            // Then log
  throw error                                           // Then throw
}
```

### 4. Don't Alert in Loops

Avoid alerting inside loops - collect errors and alert once:

```typescript
// ❌ Bad - will spam alerts
for (const item of items) {
  try {
    await processItem(item)
  } catch (error) {
    await criticalAlert.alertCriticalError('Item failed', error)
  }
}

// ✅ Good - collects errors and alerts once
const errors = []
for (const item of items) {
  try {
    await processItem(item)
  } catch (error) {
    errors.push({ item, error })
  }
}

if (errors.length > 0) {
  await criticalAlert.alertCriticalError('Batch processing failed',
    new Error(`${errors.length} items failed`),
    { errors: errors.slice(0, 5) } // Include sample
  )
}
```

### 5. Use Try-Catch for Alerts

Alert sending can fail - don't let it crash your app:

```typescript
try {
  await operation()
} catch (error) {
  try {
    await criticalAlert.alertCriticalError('Operation failed', error)
  } catch (alertError) {
    // Log but don't throw - alert failure shouldn't crash the app
    this.logger.error('Failed to send alert', alertError)
  }

  throw error
}
```

## Alert Cooldown

The system automatically prevents duplicate alerts within a 5-minute window. The same error won't trigger multiple alerts during this period.

This is tracked by: `alertType + errorMessage`

Example:
```typescript
// First alert - sends immediately
await criticalAlert.alertSquareApiFailure(new Error('Connection refused'))

// Same error 2 minutes later - skipped (cooldown active)
await criticalAlert.alertSquareApiFailure(new Error('Connection refused'))

// Different error - sends immediately (different error message)
await criticalAlert.alertSquareApiFailure(new Error('Invalid API key'))

// Same error 6 minutes later - sends (cooldown expired)
await criticalAlert.alertSquareApiFailure(new Error('Connection refused'))
```

## Severity Levels

Choose the appropriate severity for your alerts:

### CRITICAL
- System is down or severely degraded
- Data loss or corruption possible
- Immediate action required
- Examples: Database down, Square API unavailable

### HIGH
- Feature is broken but system operational
- User impact is significant
- Action required soon
- Examples: Payment processing errors, cron job failures

### MEDIUM
- Degraded performance or functionality
- User impact is limited
- Action can be scheduled
- Examples: Elevated error rates, resource warnings

## Testing Alerts

### Test in Development

```typescript
// Add to a test route
app.post('/test/alert', async (c) => {
  const container = getContainer()
  const criticalAlert = container.services.criticalAlert

  await criticalAlert.alertCriticalError(
    'Test Alert',
    new Error('This is a test alert'),
    {
      test: true,
      environment: 'development',
    }
  )

  return c.json({ success: true })
})
```

### Verify Alert Delivery

1. Check that email is received
2. Verify formatting is correct
3. Check that all context is included
4. Test cooldown behavior

## Troubleshooting

### Alerts Not Sending

1. Check email service is configured
2. Verify ADMIN_EMAIL and DEV_EMAIL are set
3. Check SendGrid API key is valid
4. Review logs for email sending errors

### Too Many Alerts

1. Review alert placement in code
2. Check for alerts in loops
3. Increase cooldown period if needed
4. Use more specific error types

### Missing Context

1. Always include relevant IDs (user, subscription, transaction)
2. Include operation name
3. Add retry attempt numbers
4. Include environment information

## Example: Full Integration

Here's a complete example integrating alerts into a use case:

```typescript
import { getContainer } from '@/container'
import type { ILogger } from '@/infrastructure/logging/logger.interface'
import type { IPaymentProvider } from '@/infrastructure/payment/payment-provider.interface'

export class ProcessPaymentUseCase {
  constructor(
    private logger: ILogger,
    private paymentProvider: IPaymentProvider
  ) {}

  async execute(userId: number, amount: number): Promise<Result> {
    const container = getContainer()
    const criticalAlert = container.services.criticalAlert

    this.logger.info('Processing payment', { userId, amount })

    try {
      // Attempt payment
      const result = await this.paymentProvider.createPayment({
        userId,
        amount,
        cardId: 'card-123',
      })

      if (!result.success) {
        // Expected failure (e.g., card declined) - don't alert
        this.logger.warn('Payment declined', {
          userId,
          reason: result.error
        })
        return { success: false, error: result.error }
      }

      this.logger.info('Payment successful', {
        userId,
        transactionId: result.transactionId
      })

      return { success: true }

    } catch (error: any) {
      // Unexpected error - alert immediately
      try {
        await criticalAlert.alertPaymentProcessingError(error, {
          userId,
          amount,
          operation: 'processPayment',
          timestamp: new Date().toISOString(),
        })
      } catch (alertError) {
        this.logger.error('Failed to send alert', alertError)
      }

      this.logger.error('Payment processing failed', error, { userId, amount })
      throw error
    }
  }
}
```
