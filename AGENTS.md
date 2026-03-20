# AGENTS.md

Billing and subscription management service for CashOffers. Handles payment processing (Square), subscription lifecycle, and user configuration.

**Read [docs/README.md](docs/README.md) before making changes.**

## Code Rules

- **No `process.env` in application code** — use `@api/config/config.service`
- **`@api/` alias** for all backend imports (no relative paths)
- **Amounts in cents** — $25.00 = `2500`
- **Business logic in use cases** — routes are thin, never put logic in route handlers
- TypeScript is type-check only (`noEmit: true`) — no build artifacts

## Architecture

Clean Architecture: Routes → Use Cases → Domain → Infrastructure

```
api/routes/        HTTP handlers (thin)
api/use-cases/     Business workflow orchestration
api/domain/        Entities, value objects, services (pure logic)
api/infrastructure/ DB, Square, SendGrid, external APIs
api/cron/          Subscription renewal scheduler
```

Docs: [system/architecture.md](docs/system/architecture.md)

## Key Docs

| Topic                      | Doc                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| Subscription lifecycle     | [business/capabilities/subscription-lifecycle.md](docs/business/capabilities/subscription-lifecycle.md)   |
| Payment retry rules        | [business/rules/payment-retry-rules.md](docs/business/rules/payment-retry-rules.md)                       |
| Role mapping rules         | [business/rules/role-mapping-rules.md](docs/business/rules/role-mapping-rules.md)                         |
| Product-driven user config | [business/decisions/product-driven-user-config.md](docs/business/decisions/product-driven-user-config.md) |
| Renewal flow               | [system/data-flows/renewal-flow.md](docs/system/data-flows/renewal-flow.md)                               |
| Purchase flow              | [system/data-flows/purchase-flow.md](docs/system/data-flows/purchase-flow.md)                             |
| Known TODOs                | [development/quality/todos.md](docs/development/quality/todos.md)                                         |
| Discrepancies              | [development/quality/discrepancies.md](docs/development/quality/discrepancies.md)                         |
