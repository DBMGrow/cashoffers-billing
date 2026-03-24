# Scenario: New User Purchase

## Goal
A brand-new user subscribes to a CashOffers plan. Payment is processed and the
subscription is created before the user account is provisioned. If user provisioning
fails, the subscription still exists and the admin is notified.

## Preconditions
- Product exists and is active
- Card nonce provided (from Square payment form)
- User does not exist in main API

## Steps
1. User fills out checkout form with name, email, card details
2. Frontend submits `POST /api/purchase/new`
3. System validates input and product
4. System creates card via Square
5. System charges card (signup fee + renewal cost)
6. System creates subscription with `user_id = null`, `status = 'active'`
7. System creates transaction record
8. System attempts user creation in main API with product `user_config`
   - **Success** → subscription updated with `user_id`, `provisioning_status = 'provisioned'`; session cookie set; `UserCreated` event emitted
   - **Failure** → subscription marked `provisioning_status = 'pending_provisioning'`; admin alert sent; `UserProvisioningFailed` event emitted; frontend receives `{ success: 'success', userProvisioned: false }`
9. Confirmation email sent (via `SubscriptionCreated` event)

## Expected Results

### Happy path
- Subscription record active with `user_id` bound
- Transaction record created
- User exists in main API with correct role, premium status, whitelabel
- Session cookie set; user lands on welcome page

### Provisioning failure
- Subscription and transaction records exist (customer was charged)
- `user_id = null`, `provisioning_status = 'pending_provisioning'`
- Admin receives alert email with subscription ID and customer email
- `UserProvisioningFailed` event published
- Frontend receives `{ success: 'success', userProvisioned: false, user: null }`
- Customer does not receive a session cookie and cannot log in until manual resolution
- Subscription is excluded from cron renewal until `user_id` is bound

## Edge Cases
- **Card declined** → `CARD_CREATION_FAILED` (400) — customer can retry with new card details
- **Payment fails** → `PAYMENT_FAILED` (500) — payment did not complete; no subscription created; no refund needed
- **System error after payment, before subscription** → no refund; admin alerted for manual provisioning; customer emailed
- **Subscription created, then provisioning fails** → no refund; admin alerted; customer emailed; `pending_provisioning`; welcome email **not** sent
- **Product has no signup fee** → charge = renewal_cost only

## Linked Rules
- [Role Mapping Rules](../../business/rules/role-mapping-rules.md)
- [Authorization Rules](../../business/rules/authorization-rules.md)

## Data Flow
- [Purchase Flow](../../system/data-flows/purchase-flow.md)

## Integration Test
- Status: partial (no full new-user flow test found)
- File: see `api/tests/integration/cashoffers-module.test.ts` for related coverage
- Needed: test for provisioning failure path (success response, pending_provisioning status, admin alert)

## Dev CLI Support
- Status: yes
- Command: `yarn dev:tools scenario renewal-due` (creates user + subscription for testing)
