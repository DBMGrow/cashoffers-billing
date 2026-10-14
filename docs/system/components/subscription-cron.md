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
5. HomeUptick `status = trial` blocks: expire ended trials, warn 10 days out
6. Card-on-file trials (Desk #1350): `findTrialsEndingWithin(7)` finds active subscriptions whose `data.trial.ends_at` is within 7 days, not cancel-on-renewal, with no `data.trial.reminder_sent_at`; each gets one `trial-ending` email, then `stampTrialReminderSent` writes the stamp with `JSON_SET` (a failed send logs `warn` and is retried next run)
7. Card-on-file trial invariants (Desk #1350), read-only: `findTrialsWithoutCard(now)` (active, before `data.trial.ends_at`, not cancel-on-renewal, the user has no `UserCards` row with a card id) logs each row at `error` as "Trial has no card on file", and `findEndedTrialsUnreconciled(now)` (`ends_at` and `renewal_date` both over 24 hours ago with no completed paid `RENEWAL` purchase request, not cancelled or cancel-on-renewal, `payment_failure_count = 0`) logs each as "Ended trial not reconciled". Both carry `subscription_id`, `user_id` and `product_id`; the daily health report counts the same two queries. The drift check (D1) reads `findUnconvertedTrials()` (a `data.trial` object, not cancelled, no completed paid `RENEWAL` and none in `CREATING_SUBSCRIPTION` or `FINALIZING`) and logs each row whose `ends_at` and `renewal_date` differ by more than a second as "Trial date drift: subscription N has ends_at X but renewal_date Y", with both dates in the metadata. It never corrects the row; the error reaches the health report's error count and list

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
