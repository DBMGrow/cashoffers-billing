# Capability: Subscription Lifecycle

## Business Outcome
Users can purchase, manage, and cancel subscriptions to CashOffers services. The system automates renewals and handles failures gracefully.

## Actors
- **User**: Purchases and manages their own subscription
- **Admin**: Can manage any subscription
- **System (cron)**: Renews subscriptions automatically on schedule

## States

```
free_trial → active → paused
                    ↓
              cancel_on_renewal (flag, still active until period ends)
              downgrade_on_renewal (flag, still active until period ends)
                    ↓
              inactive / expired
```

## What Should Happen

### Purchase (New User)
1. Validate product exists and is available
2. Create card via Square
3. Create user in main API with product `user_config`
4. Charge signup fee (if any)
5. Create subscription with `next_renewal_at` set
6. Send confirmation email

### Purchase (Existing User)
1. Validate product and user
2. Create or reuse card
3. Calculate prorate if upgrading
4. Charge (including prorate if applicable)
5. Create subscription
6. Send confirmation email

### Renewal (automated)
1. Cron finds subscriptions where `next_renewal_at <= now`
2. Fetch user from main API — skip if inactive
3. Check for `cancel_on_renewal` → cancel instead
4. Check for `downgrade_on_renewal` → downgrade instead
5. Process payment
6. Update `next_renewal_at`
7. Send renewal email

### Pause / Resume
- Pausing sets status to `paused` and records `paused_at`
- Resuming restores status to `active` and calculates new `next_renewal_at`

### Cancel on Renewal
- Sets `cancel_on_renewal: true` flag
- Subscription remains active until period ends
- On next renewal cron run: deactivate instead of renewing

### Mark for Downgrade
- Sets `downgrade_on_renewal: true` and stores target product
- On next renewal: downgrade to target product instead of renewing

## Edge Cases
- User is inactive in main API → skip renewal (no payment, no update)
- Payment fails → schedule retry (see [Payment Retry Rules](../rules/payment-retry-rules.md))
- HomeUptick addon subscriptions are separate subscriptions linked to the main one
- Free trial expiration triggers its own cron path

## Related Rules
- [Subscription Rules](../rules/subscription-rules.md)
- [Payment Retry Rules](../rules/payment-retry-rules.md)
- [Role Mapping Rules](../rules/role-mapping-rules.md)

## Related Scenarios
- [New User Purchase](../../development/scenarios/new-user-purchase.md)
- [Subscription Renewal](../../development/scenarios/subscription-renewal.md)
- [Pause Resume](../../development/scenarios/pause-resume.md)
- [Cancel on Renewal](../../development/scenarios/cancel-on-renewal.md)

## Current vs Intended Behavior
- Renewals do **not** re-apply user configuration (role, premium). This is intentional for regular renewals.
- Upgrade/downgrade user config updates are not yet implemented (future work).
- Suspension cron is stubbed — not yet automated.

## Unknowns
- Exact behavior when downgrading between different whitelabel products is unconfirmed.
