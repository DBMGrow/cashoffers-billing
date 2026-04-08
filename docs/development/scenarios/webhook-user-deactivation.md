# Scenario: Webhook — User Deactivation

## Goal
When the main CashOffers API deactivates a user, their subscription renewals are paused automatically.

## Preconditions
- User has an active subscription
- Main API sends a deactivation webhook

## Steps
1. Main API POST `/api/webhooks` with `{ type: "user.deactivated", userId: 123 }`
2. Webhook handler processes the event
3. On next cron run: cron fetches user from main API, sees `active: false`
4. Cron skips this user's subscription — no charge

## Expected Result
- No charge on next renewal date
- Subscription remains in database (not deleted)
- When user is reactivated (webhook or direct), renewals resume

## Edge Cases
- Webhook arrives for unknown user → log and ignore
- Duplicate webhook → idempotent

## Linked Rules
- [Subscription Rules](../../business/rules/subscription-rules)

## Integration Test
- Status: yes
- File: `api/tests/integration/webhook-cashoffers.test.ts`

## Dev CLI Support
- Status: yes
- Command: `yarn dev:tools webhook user.deactivated <user_id>`
