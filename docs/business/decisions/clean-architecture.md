# Decision: Clean Architecture (Use Cases, Domain, Infrastructure)

## Context
The system started as Express.js with inline business logic in route handlers. As complexity grew (renewals, retries, HomeUptick, whitelabel), the code became hard to test and maintain.

## Decision
Adopt Clean Architecture with four layers:
1. **Routes** — thin HTTP handlers, validate input and delegate
2. **Use Cases** — orchestrate business workflows
3. **Domain** — core entities, value objects, services (pure logic)
4. **Infrastructure** — external integrations (DB, Square, SendGrid, APIs)

## Alternatives Considered
- Keep inline logic in routes: easy short-term, hard to test and evolve
- Service layer only (no domain): simpler but blurs boundaries

## Tradeoffs
- More files and boilerplate for simple operations
- Clear separation makes testing and reasoning much easier
- Domain logic is framework-agnostic and independently testable

## Impact
- Business logic must live in use cases or domain, never in routes or infrastructure
- New features should follow: route → use case → domain/infrastructure
- `@api/` import alias is enforced; relative paths in backend code should be avoided
