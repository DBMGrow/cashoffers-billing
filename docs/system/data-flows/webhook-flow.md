# Data Flow: Webhooks

## CashOffers Webhook (User Activation/Deactivation)

```
Main CashOffers API
  → POST /api/webhooks
      Body: { type: "user.activated" | "user.deactivated", userId }
  → WebhookHandler (api/application/webhook-handlers/)
      → Record user active state (or rely on real-time check at renewal)
      → Emit domain event if applicable
```

**Effect on renewals**: The cron job reads user `active` status from the main API at renewal time. A deactivated user is skipped.

## Key Files
- `api/routes/webhooks/routes.ts`
- `api/application/webhook-handlers/`
- `api/tests/integration/webhook-cashoffers.test.ts`

## Square Webhooks

Square sends payment events (payment completed, refunded, etc.) to a configured endpoint. Current status of Square webhook handler is unclear — see [Discrepancies](../../development/quality/discrepancies.md).
