# Capability: Free Trials

## Business Outcome
Users can start a subscription on a free trial period. When the trial ends, the subscription either converts to paid or expires.

## Actors
- **User**: Signs up for a trial
- **System (cron)**: Detects expired trials and processes them

## What Should Happen

### Create Free Trial
1. Validate product supports trial
2. Create subscription with status `free_trial` and `trial_ends_at` set
3. No payment is taken
4. Send trial start email (if configured)

### Trial Expiration (automated)
1. Cron finds subscriptions where `trial_ends_at <= now` and status is `free_trial`
2. Attempt to charge the renewal cost
3. On success: update status to `active`, set `next_renewal_at`
4. On failure: mark as expired/inactive, send failure email

## Edge Cases
- User cancels during trial → status set to inactive, no charge
- Trial period ends with no card on file → cannot convert, mark expired
- Trial with `cancel_on_renewal` flag → cancel instead of converting

## Related Rules
- [Subscription Rules](../rules/subscription-rules.md)
- [Payment Retry Rules](../rules/payment-retry-rules.md)

## Related Scenarios
- [Trial Expiration](../../development/scenarios/trial-expiration.md)

## Current vs Intended Behavior
- Trial expiration is handled by the main subscription cron.
- Integration test exists: `api/tests/integration/free-trial.test.ts`

## Unknowns
- Whether trial-to-paid conversion sends a different email than a regular renewal is unconfirmed.
