# Runbook: Testing

## Running Tests

```bash
yarn test                    # Run all tests
yarn test --watch            # Watch mode
yarn test:ui                 # Visual test runner (Vitest UI)
yarn test api/tests/integration/free-trial.test.ts  # Single file
```

## Test Types

### Unit Tests
- Location: `api/use-cases/**/*.test.ts`, `api/domain/**/*.test.ts`
- What: individual use cases, domain entities, value objects
- Dependencies: mocked

### Integration Tests
- Location: `api/tests/integration/*.test.ts`
- What: full workflows end-to-end within the service (DB + use cases, no external APIs)
- Dependencies: test DB, mocked external APIs (Square, SendGrid, Main API)

### E2E Tests (Playwright)
- Location: `tests/e2e/*.test.ts`
- What: UI flows through a real browser
- Run: `yarn test:e2e`

## Integration Test Coverage

| Test File | Scenario |
|-----------|----------|
| `cashoffers-module.test.ts` | CashOffers subscription workflows |
| `homeuptick-module.test.ts` | HomeUptick addon subscriptions |
| `free-trial.test.ts` | Trial creation and expiration |
| `renewal-homeuptick-tiers.test.ts` | HomeUptick tier-based renewals |
| `pause-resume.test.ts` | Pause and resume flows |
| `retry-and-suspension.test.ts` | Payment retry and suspension |
| `card-update-retry.test.ts` | Card update during retry window |
| `webhook-cashoffers.test.ts` | CashOffers webhook handling |

## Type Checking
```bash
yarn build     # Type-check TypeScript (noEmit — no artifacts)
```

## Writing Tests
- New use cases → add test file alongside: `my-use-case.test.ts`
- New flows → add integration test in `api/tests/integration/`
- Tests should mock external calls (Square, Main API, SendGrid)
- Use `@api/` imports in tests

## Test Setup
- `api/tests/setup.ts` — global test configuration
- Vitest config: `vitest.config.ts`
