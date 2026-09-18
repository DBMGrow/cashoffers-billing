# Capability: Email Notifications

## Business Outcome
Users receive transactional emails for key lifecycle events so they are aware of charges, failures, and subscription changes.

## Actors
- **User**: Receives emails
- **System**: Sends emails via SendGrid

## Emails Sent

| Event | Template | Recipient |
|-------|----------|-----------|
| Subscription purchased (user provisioned) | subscriptionCreated | User |
| Purchase error (provisioning or system failure) | purchaseErrorCustomer | User |
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
- When user provisioning fails during purchase, the welcome email (`subscriptionCreated`) is **not** sent. Instead, the customer receives the `purchaseErrorCustomer` email confirming payment was received and the team is resolving the issue.
- **$0 subscriptions (free products):** Subscription-created and renewal emails are suppressed when `amount === 0`. The renewal cron still advances the renewal date but no payment is attempted and no email is sent.
- **Third-party (corporate) billing — `hides_billing` products:** When a subscription's product has `Products.data.hides_billing = true`, corporate pays for the subscriber and the dashboard hides their Billing tab (dashboard-mono `computeHideBilling`, `docs/plans/hide-billing-tab-phase-0-plan.md` there). The charge-confirmation emails — the paid `subscription-created` receipt and the `subscription-renewal` receipt — are suppressed for these users, because the charged card isn't theirs and a "you've been charged" email misleads them. Accounts created before the grandfather cutoff (2026-08-01 UTC, mirrored as `BILLING_GRANDFATHER_CUTOFF` in `api/domain/services/billing-visibility.service.ts`) keep their Billing tab and therefore keep their emails. Trial-welcome ($0, no charge) and all other lifecycle emails are unaffected. Lookup failures fail open (the email is sent). Note: the dashboard's `hide_billing_for_corporate_products` rollout flag is not consulted here — suppression keys on the durable rule (product data + cutoff) only.

## Current vs Intended Behavior
- All templates are React Email (migrated from MJML).
- Preview available via `yarn preview:emails`.

## Unknowns
- Whether all lifecycle events listed above have corresponding templates implemented — needs audit.
