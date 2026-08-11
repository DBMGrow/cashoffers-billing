# Integration Test Coverage

## Status Summary

| Scenario | Integration Test | File |
|----------|-----------------|------|
| New user purchase | partial | `cashoffers-module.test.ts` |
| Existing user purchase | partial | `cashoffers-module.test.ts` |
| Subscription renewal (success) | yes | `cashoffers-module.test.ts` |
| Subscription renewal (failure + retry) | yes | `retry-and-suspension.test.ts` |
| Free trial creation | yes | `free-trial.test.ts` |
| Free trial expiration (success) | yes | `free-trial.test.ts` |
| Free trial expiration (failure) | yes | `free-trial.test.ts` |
| Pause subscription | yes | `pause-resume.test.ts` |
| Resume subscription | yes | `pause-resume.test.ts` |
| Cancel on renewal | yes | `cashoffers-module.test.ts` |
| Downgrade on renewal | partial | `cashoffers-module.test.ts` |
| HomeUptick addon renewal | yes | `homeuptick-module.test.ts` |
| HomeUptick tier-based renewal | yes | `renewal-homeuptick-tiers.test.ts` |
| Card update on retry | **no** | — (`card-update-retry.test.ts` does not exist) |
| Webhook user deactivation | yes | `webhook-cashoffers.test.ts` |
| Suspension after max retries | partial | `retry-and-suspension.test.ts` |
| Property unlock | no | — |
| Whitelabel checkout | no | — |

## Gaps
- Full new-user purchase end-to-end test (with card creation + user creation in main API)
- Property unlock integration test
- Whitelabel-specific flow tests
- **Card update on retry** — listed as covered until 2026-08-07; the file it named
  does not exist and appears never to have been committed.

## Suite health

`yarn test` runs **567 tests across 53 files; 545 pass**. The ~20 failures are stale
assertions, not new regressions — they were invisible until 2026-08-07 because the
runner was misconfigured and most files never collected. Largest cluster:
`retry-and-suspension.test.ts` still asserts the elapsed-time retry model that
`payment_failure_count` replaced (see [payment-retry-rules.md](../../business/rules/payment-retry-rules.md),
note on attempt tracking) and an auto-suspension that doc records as "not yet automated".

## All Integration Test Files
- `api/tests/integration/cashoffers-module.test.ts`
- `api/tests/integration/homeuptick-module.test.ts`
- `api/tests/integration/free-trial.test.ts`
- `api/tests/integration/renewal-homeuptick-tiers.test.ts`
- `api/tests/integration/pause-resume.test.ts`
- `api/tests/integration/retry-and-suspension.test.ts`
- `api/tests/integration/card-update-retry.test.ts`
- `api/tests/integration/webhook-cashoffers.test.ts`
