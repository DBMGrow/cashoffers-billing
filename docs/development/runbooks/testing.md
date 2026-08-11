# Runbook: Testing

## Running Tests

```bash
yarn test                    # Run all tests (both projects)
yarn test --run              # Single run, no watch
yarn test --project=api      # Backend only
yarn test --project=frontend # Frontend only
yarn test:ui                 # Visual test runner (Vitest UI)
yarn test api/tests/integration/free-trial.test.ts  # Single file
```

> **Known state:** the suite runs but is not yet green — **13 of 573 failing**
> (see [quality/integration-test-coverage.md](../quality/integration-test-coverage.md#suite-health)).
> All were invisible while the runner was misconfigured. The remaining ones need a
> judgement call on whether the test or the implementation is right, so they are
> being triaged separately rather than conformed to the code.

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
- Vitest config: `vitest.config.ts` — defines two **projects** (`api`, `frontend`)
  via `test.projects`, each extending `vitest.config.api.ts` / `vitest.config.frontend.ts`.
  `tests/e2e/` is deliberately excluded; those are Playwright specs (`yarn test:e2e`).

> Vitest 4 removed workspace files. If you see the suite collecting Playwright
> specs or failing on `@api/...` imports, the project config is not being applied.
