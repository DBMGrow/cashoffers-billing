# Rule: Subscription Rules

## Status Transitions

| From | To | How |
|------|----|-----|
| free_trial | active | Trial converted on payment success |
| free_trial | inactive | Trial expired, payment failed or cancelled |
| active | paused | User or admin pauses |
| paused | active | User or admin resumes |
| active | active | Renewal (no state change, only `next_renewal_at` updates) |
| active | inactive | Deactivated by admin, or cancelled after `cancel_on_renewal` |
| any | inactive | Admin deactivation |

## Flags (non-status)
- `cancel_on_renewal` — subscription will be cancelled instead of renewed on next cron run
- `downgrade_on_renewal` — subscription will be downgraded on next cron run

## Rules
1. A paused subscription is **not renewed** by cron.
2. An inactive user (per main API) is **not renewed** by cron, regardless of subscription status.
3. A subscription with `cancel_on_renewal: true` is **cancelled, not charged**, on next cron run.
4. A subscription with `downgrade_on_renewal: true` is **downgraded, not renewed normally**, on next cron run.
5. Renewals do **not** modify user configuration in the main API.
6. A subscription cannot transition directly from `paused` to `inactive` — must go through `active` or be explicitly deactivated.

## Where Enforced
- `api/use-cases/subscription/renew-subscription.use-case.ts`
- `api/use-cases/subscription/pause-subscription.use-case.ts`
- `api/use-cases/subscription/resume-subscription.use-case.ts`
- `api/use-cases/subscription/cancel-on-renewal.use-case.ts`
- `api/use-cases/subscription/mark-for-downgrade.use-case.ts`
- `api/cron/subscriptionsCron.ts`

## Missing Enforcement
- Suspension logic (automated) is not yet implemented — suspension cron is stubbed.
- Downgrade on renewal is flagged but the actual downgrade flow is not fully implemented.
