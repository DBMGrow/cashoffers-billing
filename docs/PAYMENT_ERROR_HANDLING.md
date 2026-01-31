# Payment Error Handling Guide

This document explains how to use the enhanced payment error handling system to provide user-friendly, actionable error messages.

## Overview

The payment error handling system translates technical Square API error codes into user-friendly messages with recovery suggestions. This helps users understand what went wrong and what actions they can take.

## Architecture

```
Square API Error
     ↓
IPaymentErrorTranslator
     ↓
PaymentError (user-friendly)
     ↓
Display to User
```

## Components

### PaymentError

The translated error object contains:

```typescript
{
  code: string              // Original Square error code
  category: PaymentErrorCategory  // High-level category
  title: string             // User-friendly title
  message: string           // User-friendly description
  suggestions: string[]     // Actionable recovery steps
  developerMessage: string  // Technical details for debugging
  retryable: boolean        // Whether payment can be retried
  contactSupport: boolean   // Whether user should contact support
}
```

### Error Categories

- **CARD_DECLINED** - Card was declined by bank
- **INSUFFICIENT_FUNDS** - Not enough funds available
- **CARD_EXPIRED** - Card expiration date has passed
- **INVALID_CARD** - Card number or details are invalid
- **AUTHENTICATION_REQUIRED** - Additional auth needed
- **NETWORK_ERROR** - Temporary network issue (retryable)
- **RATE_LIMIT** - Too many attempts (retryable)
- **CONFIGURATION_ERROR** - Payment system config issue
- **UNKNOWN** - Unrecognized error

## Usage Examples

### Basic Usage

```typescript
import { container } from '@/container'

// Get error translator from container
const errorTranslator = container.services.paymentErrorTranslator

// Translate a Square error
try {
  const payment = await paymentProvider.createPayment(...)
} catch (error) {
  const translatedError = errorTranslator.translate(error)

  // Show to user
  console.log(translatedError.title)      // "Card Declined"
  console.log(translatedError.message)    // "Your card was declined..."
  console.log(translatedError.suggestions) // ["Try a different payment method", ...]

  // Log for debugging
  logger.error(translatedError.developerMessage)
}
```

### In Use Cases

```typescript
// In CreatePaymentUseCase
async execute(input: CreatePaymentInput): Promise<UseCaseResult<CreatePaymentOutput>> {
  try {
    const payment = await this.paymentProvider.createPayment(...)

    if (payment.status !== "COMPLETED") {
      const error = errorTranslator.translate(payment.error)

      // Send user-friendly error email
      await this.emailService.sendEmail({
        to: input.email,
        subject: error.title,
        template: "paymentError.html",
        fields: {
          errorTitle: error.title,
          errorMessage: error.message,
          suggestions: error.suggestions.join("<br>"),
        }
      })

      // Return failure with user-friendly message
      return failure(error.message, error.code)
    }

    return success(...)
  } catch (error) {
    const translatedError = errorTranslator.translate(error)

    logger.error("Payment failed", {
      code: translatedError.code,
      category: translatedError.category,
      retryable: translatedError.retryable,
    })

    return failure(translatedError.message, translatedError.code)
  }
}
```

### Error Response Format

For API endpoints, return errors in a consistent format:

```typescript
// Express/Hono route handler
app.post("/api/payment", async (req, res) => {
  const result = await createPaymentUseCase.execute(req.body)

  if (!result.success) {
    // Translate if not already translated
    const error = errorTranslator.translateCode(result.code || "UNKNOWN")

    return res.status(400).json({
      error: {
        code: error.code,
        title: error.title,
        message: error.message,
        suggestions: error.suggestions,
        retryable: error.retryable,
        contactSupport: error.contactSupport,
      }
    })
  }

  return res.json({ data: result.data })
})
```

## Supported Error Codes

### Card Declined
- `CARD_DECLINED` - Generic card decline
- `CVV_FAILURE` - Security code mismatch
- `ADDRESS_VERIFICATION_FAILURE` - Address doesn't match
- `GENERIC_DECLINE` - Generic decline

### Insufficient Funds
- `INSUFFICIENT_FUNDS` - Not enough money

### Card Expired
- `EXPIRED_CARD` - Card has expired

### Invalid Card
- `INVALID_CARD` - Card number invalid
- `INVALID_EXPIRATION` - Expiration date invalid
- `CARD_NOT_SUPPORTED` - Card type not supported
- `PAN_FAILURE` - Card number validation failed

### Authentication
- `CARDHOLDER_INSUFFICIENT_PERMISSIONS` - Card blocked by issuer

### Network/Temporary
- `TEMPORARY_ERROR` - Temporary issue (retryable)

### Rate Limiting
- `RATE_LIMITED` - Too many attempts (retryable)

### Configuration
- `INVALID_ACCOUNT` - Payment config issue
- `BAD_REQUEST` - Invalid request

## Best Practices

### 1. Always Translate Errors

```typescript
// ❌ Don't show raw error codes
return { error: "CARD_DECLINED" }

// ✅ Translate to user-friendly message
const error = errorTranslator.translateCode("CARD_DECLINED")
return { error: error.message, suggestions: error.suggestions }
```

### 2. Provide Recovery Suggestions

```typescript
// Show actionable steps
error.suggestions.forEach(suggestion => {
  console.log("• " + suggestion)
})
```

### 3. Log Technical Details

```typescript
// User sees friendly message
console.log(error.message)

// Logs contain technical details
logger.error(error.developerMessage, {
  code: error.code,
  category: error.category,
})
```

### 4. Handle Retryable Errors

```typescript
if (error.retryable) {
  // Show "Try Again" button
  showRetryButton()
} else {
  // Show "Update Payment Method" button
  showUpdatePaymentButton()
}
```

### 5. Escalate Unknown Errors

```typescript
if (error.contactSupport) {
  // Show contact support link
  showSupportContact()

  // Alert dev team
  alertDevTeam(error.developerMessage)
}
```

## Testing

```typescript
import { SquareErrorTranslator } from '@/infrastructure/payment/error/square-error-translator'

describe("Payment Error Handling", () => {
  const translator = new SquareErrorTranslator()

  it("should translate card declined error", () => {
    const error = translator.translateCode("CARD_DECLINED")

    expect(error.title).toBe("Card Declined")
    expect(error.suggestions).toContain("Try a different payment method")
    expect(error.retryable).toBe(false)
  })
})
```

## Integration Checklist

- [ ] Error translator added to DI container
- [ ] Use cases use error translator for payment failures
- [ ] API endpoints return translated errors
- [ ] Email templates include user-friendly error messages
- [ ] Logs include technical error details
- [ ] UI shows recovery suggestions
- [ ] Retry logic respects `retryable` flag
- [ ] Support contact shown when `contactSupport` is true

## Future Enhancements

- Add support for other payment providers (Stripe, PayPal)
- Localization/translation of error messages
- A/B testing different error message variations
- Analytics tracking for error categories
- Automatic retry with exponential backoff for retryable errors
