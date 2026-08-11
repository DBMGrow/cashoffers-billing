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

`yarn test` runs **573 tests across 52 files; 558 pass** (2026-08-07). None of the
failures are new regressions — all were invisible until the runner was fixed, because
most files never collected.

**Fixed:** the whole `retry-and-suspension` suite (it set up scenarios by back-dating
`next_renewal_attempt`, the model `payment_failure_count` replaced — see
[payment-retry-rules.md](../../business/rules/payment-retry-rules.md)); the pause status
assertion (`paused`, not `suspended` — those are distinct states); renewal transaction
logging (a successful renewal writes **two** records by design, `payment` and
`subscription`); and a `@/` → `@api/` mock alias that made a suite register zero tests.
`getHomeUptickSubscription2` was renamed to `.manual.ts` — it is a live-DB probe, not a
unit test, and was failing collection in the CI tier.

**Still failing — 13, needing a decision rather than a fix:**

| Cluster | Count | The question |
| --- | --- | --- |
| `cashoffers-module` + `create-subscription` | 6 | User provisioning moved out of the use case into an event handler. **`whitelabel_id` now arrives `undefined` where the test expects `7`** — decide whether that is a stale fixture or a real defect before touching the test. |
| `hooks/api/*`, `getUniqueSlug` | 7 | React Query hook tests never resolve; likely a shared fetch-mock setup issue. |

## All Integration Test Files
- `api/tests/integration/cashoffers-module.test.ts`
- `api/tests/integration/homeuptick-module.test.ts`
- `api/tests/integration/free-trial.test.ts`
- `api/tests/integration/renewal-homeuptick-tiers.test.ts`
- `api/tests/integration/pause-resume.test.ts`
- `api/tests/integration/retry-and-suspension.test.ts`
- `api/tests/integration/card-update-retry.test.ts`
- `api/tests/integration/webhook-cashoffers.test.ts`
