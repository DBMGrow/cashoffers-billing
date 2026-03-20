# Integration: Square

## Purpose
Square handles credit card tokenization, charges, and refunds.

## Key Files
- `api/config/square.ts` — Square client setup
- `api/infrastructure/payment/square/square.provider.ts` — API calls
- `api/infrastructure/payment/error/square-error-translator.ts` — Error mapping

## Config
```
SQUARE_ENVIRONMENT=sandbox|production
SQUARE_ACCESS_TOKEN=...
NEXT_PUBLIC_SQUARE_APP_ID=...
NEXT_PUBLIC_SQUARE_LOCATION_ID=...
```

## What We Use
- **Card tokenization**: Frontend uses React Square Web Payments SDK; produces a nonce
- **Charges**: Backend sends nonce + amount to Square
- **Refunds**: Reference the original Square transaction ID
- **Webhooks**: Square sends payment events (partially wired — see discrepancies)

## Error Handling
Square errors are translated to domain errors via `square-error-translator.ts`. Common errors:
- `CARD_DECLINED` → retry eligible
- `INVALID_CARD` → not retry eligible
- `GENERIC_DECLINE` → retry eligible

## Notes
- Amounts must be in cents (Square also uses cents)
- Sandbox vs production is controlled by `SQUARE_ENVIRONMENT`
