# Scenario: New User Purchase

## Goal
A brand-new user subscribes to a CashOffers plan, creating their account and starting their subscription.

## Preconditions
- Product exists and is active
- Card nonce provided (from Square payment form)
- User does not exist in main API

## Steps
1. User fills out checkout form with name, email, card details
2. Frontend submits `POST /api/purchase/new-user`
3. System creates card via Square
4. System creates user in main API with product `user_config`
5. System charges signup fee (if > 0)
6. System creates subscription with `next_renewal_at = now + duration`
7. Confirmation email sent

## Expected Result
- User exists in main API with correct role, premium status, whitelabel
- Subscription record created with status `active`
- Transaction record created
- Confirmation email sent

## Edge Cases
- Card declined → user is created but subscription is not; cleanup may be needed
- Main API user creation fails → entire purchase fails
- Product has no signup fee → no charge, subscription created directly

## Linked Rules
- [Role Mapping Rules](../../business/rules/role-mapping-rules)
- [Authorization Rules](../../business/rules/authorization-rules)

## Integration Test
- Status: partial (no full new-user flow test found)
- File: see `api/tests/integration/cashoffers-module.test.ts` for related coverage

## Dev CLI Support
- Status: yes
- Command: `yarn dev:tools scenario renewal-due` (creates user + subscription for testing)
