# Component: Payment Processor

## What It Does
Orchestrates all payment operations through Square. Translates Square responses to domain results and handles error translation.

## Key Files
- `api/infrastructure/payment/square/square.provider.ts` — Square API calls
- `api/infrastructure/payment/error/square-error-translator.ts` — Error translation
- `api/use-cases/payment/create-payment.use-case.ts` — Charge orchestration
- `api/use-cases/payment/refund-payment.use-case.ts` — Refund orchestration

## Inputs
- Card nonce (from Square Web Payments SDK on frontend)
- Amount in cents
- User/subscription context

## Outputs
- Transaction record (success or failure)
- Domain event: `PaymentProcessed` or `PaymentFailed`
- Email notification

## Flow

```
CreatePaymentUseCase
  → Square.charge(nonce, amount)
  → Log transaction to DB
  → Emit PaymentProcessed event
  → (handler) Send receipt email
```

## Failure Modes
- Card declined → `PaymentFailed` event, retry scheduled
- Square API error → translated to domain error, logged
- Network timeout → treated as failure

## Related Capabilities
- [Payment Processing](../../business/capabilities/payment-processing)

## Gaps vs Intended Behavior
- Card update via manage endpoint is not implemented (TODO in `api/routes/manage/routes.ts:346`)
