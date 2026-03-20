# Data Flow: Webhooks

## CashOffers Webhook (User Activation/Deactivation)

```mermaid
sequenceDiagram
  participant Main as Main CashOffers API
  participant Billing as /api/webhooks
  participant Handler as WebhookHandler

  Main->>Billing: POST { type: "user.activated" | "user.deactivated", userId }
  Billing->>Handler: route to handler
  Handler->>Handler: record user active state
  opt event applicable
    Handler->>Handler: emit domain event
  end
```

**Effect on renewals**: The cron job reads user `active` status from the main API at renewal time. A deactivated user is skipped.

## Key Files
- `api/routes/webhooks/routes.ts`
- `api/application/webhook-handlers/`
- `api/tests/integration/webhook-cashoffers.test.ts`

## Square Webhooks

Square sends payment events (payment completed, refunded, etc.) to a configured endpoint. Current status of Square webhook handler is unclear — see [Discrepancies](../../development/quality/discrepancies).
