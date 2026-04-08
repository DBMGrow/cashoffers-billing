# AGENTS.md

Billing and subscription management service for CashOffers. Handles payment processing (Square), subscription lifecycle, and user configuration.

**Read [docs/README.md](docs/README.md) before making changes.**

## Code Rules

1. Work docs-first and keep them in sync. All work starts from docs. Docs define business logic first, then implementation, and are continuously updated with progress and decisions.
2. Plan before coding. Write a concise plan outlining changes, tests, and assumptions before touching code.
3. Make small, focused changes. Implement the minimum needed in clean, reviewable increments—no unrelated refactors.
4. Follow existing patterns and don’t guess. Adhere to repo conventions and resolve ambiguity from docs or context; explicitly state any assumptions.
5. Test thoroughly at all levels. Every feature includes unit and integration tests (and e2e where needed), covering edge cases and failures.
6. Build for production from the start. Include validation, error handling, logging, observability, and safe rollout considerations in every feature.
7. Keep everything complete and consistent. A feature isn’t done until code, tests, docs, and developer tooling (e.g., CLI support) are all updated and aligned.

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
