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
| Card update on retry | yes | `card-update-retry.test.ts` |
| Webhook user deactivation | yes | `webhook-cashoffers.test.ts` |
| Suspension after max retries | partial | `retry-and-suspension.test.ts` |
| Property unlock | no | — |
| Whitelabel checkout | no | — |

## Gaps
- Full new-user purchase end-to-end test (with card creation + user creation in main API)
- Property unlock integration test
- Whitelabel-specific flow tests

## All Integration Test Files
- `api/tests/integration/cashoffers-module.test.ts`
- `api/tests/integration/homeuptick-module.test.ts`
- `api/tests/integration/free-trial.test.ts`
- `api/tests/integration/renewal-homeuptick-tiers.test.ts`
- `api/tests/integration/pause-resume.test.ts`
- `api/tests/integration/retry-and-suspension.test.ts`
- `api/tests/integration/card-update-retry.test.ts`
- `api/tests/integration/webhook-cashoffers.test.ts`
