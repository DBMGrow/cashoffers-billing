# Component: Subscription Cron

## What It Does
Runs on a schedule to process subscription renewals, trial expirations, and payment retries. It is the main automated billing engine.

## Key Files
- `api/cron/subscriptionsCron.ts` — main cron logic
- `api/routes/cron/routes.ts` — HTTP endpoint to trigger cron manually

## Trigger
- Called by HTTP POST `/api/cron/subscriptions` with `CRON_SECRET` header
- Expected to be triggered by an external scheduler (e.g., cron, Railway, etc.)

## What It Does (Step by Step)
1. Find subscriptions where `next_renewal_at <= now` and status is `active` or `free_trial`
2. For each subscription:
   a. Fetch user from main API
   b. Skip if user is inactive
   c. If `cancel_on_renewal`: cancel and skip payment
   d. If `downgrade_on_renewal`: downgrade and skip normal renewal
   e. If `free_trial` and `trial_ends_at` expired: attempt conversion to paid
   f. Otherwise: run `RenewSubscriptionUseCase`
3. After main subscription: check for HomeUptick addon, process if present
4. On payment failure: call `updateNextRenewalAttempt` to schedule retry

## Inputs
- Database: subscriptions due for renewal
- Main API: user active status

## Outputs
- Updated `next_renewal_at` on success
- Transaction log entry (success or failure)
- Email notifications
- Retry scheduling on failure

## Failure Modes
- Main API unavailable → subscription skipped, no error escalation (needs verification)
- Square API unavailable → payment fails, retry scheduled
- Cron endpoint not called → renewals silently missed

## Related Capabilities
- [Subscription Lifecycle](../../business/capabilities/subscription-lifecycle)
- [Free Trials](../../business/capabilities/free-trials)
- [HomeUptick Integration](../../business/capabilities/homeuptick-integration)

## Gaps vs Intended Behavior
- Suspension cron (`suspendSubscriptionsCron`) is stubbed — not yet implemented
- HomeUptick tier-based renewal has a TODO at `renew-subscription.use-case.ts:114`
- No alerting if cron stops running (no dead-man's switch)
