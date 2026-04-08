# Capability: Payment Processing

## Business Outcome
Users are charged for subscriptions and one-time purchases via Square. Failed payments are retried. All transactions are logged.

## Actors
- **User**: Provides card; is charged
- **System**: Initiates charges via Square, logs results, sends notifications

## What Should Happen

### Charge
1. Look up user's stored card
2. Call Square API to charge the card
3. Log the transaction (success or failure) to `transactions` table
4. On success: send payment receipt email
5. On failure: log failure, send failure email, schedule retry

### Retry Logic
See [Payment Retry Rules](../rules/payment-retry-rules).

### Refund
1. Look up original transaction
2. Call Square API to refund
3. Log the refund
4. Send refund confirmation email

### Property Unlock (one-time charge)
- Separate from subscription payments
- Charges for unlocking a specific property record
- No renewal or retry logic

## Edge Cases
- Card declined → log failure, send alert, schedule retry
- Square API error → treated as failure, retry eligible
- Refund after subscription is cancelled → allowed by admin only

## Related Rules
- [Payment Retry Rules](../rules/payment-retry-rules)

## Related Scenarios
- [Payment Retry](../../development/scenarios/payment-retry)

## Current vs Intended Behavior
- All payments go through Square. No other processor is supported.
- Card update via manage endpoint is a known TODO (not yet implemented).

## Unknowns
- Behavior when Square sandbox vs production is unclear from config alone — depends on `SQUARE_ENVIRONMENT` env var.
