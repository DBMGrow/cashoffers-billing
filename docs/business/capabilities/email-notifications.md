# Capability: Email Notifications

## Business Outcome
Users receive transactional emails for key lifecycle events so they are aware of charges, failures, and subscription changes.

## Actors
- **User**: Receives emails
- **System**: Sends emails via SendGrid

## Emails Sent

| Event | Template | Recipient |
|-------|----------|-----------|
| Subscription purchased | subscriptionCreated | User |
| Subscription renewed | subscriptionRenewal | User |
| Payment failed | paymentFailed | User + Admin |
| Subscription cancelled | subscriptionCancelled | User |
| Free trial started | trialStarted | User |
| Free trial expiring | trialExpiring | User |
| Refund processed | refundProcessed | User |
| Admin critical alert | criticalAlert | Admin |

## How It Works
- Templates use React Email components
- `sendEmail()` utility handles SendGrid delivery
- Controlled by `SEND_EMAILS` env var (can be disabled for dev/test)
- Whitelabel-specific templates supported when configured

## Edge Cases
- Email delivery failure is logged but does not block the subscription action
- Dev environment: use `DEV_EMAIL` to redirect all emails to a single address

## Current vs Intended Behavior
- All templates are React Email (migrated from MJML).
- Preview available via `yarn preview:emails`.

## Unknowns
- Whether all lifecycle events listed above have corresponding templates implemented — needs audit.
