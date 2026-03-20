# Integration: Main CashOffers API

## Purpose
The main API owns user data. Billing reads and writes user state (create user, update role, premium status, whitelabel) through it.

## Key Files
- `api/infrastructure/external-api/user-api/user-api.client.ts`

## Config
```
API_URL=https://api.cashoffers.com
API_URL_V2=https://api.cashoffers.com/v2
API_MASTER_TOKEN=...
API_ROUTE_AUTH=/api/auth/verify-token
API_ROUTE_AUTH_V2=/api/v2/auth/verify-token
```

## What We Use
- **Verify token**: Validate user JWTs on every request
- **Get user**: Fetch user data including `active` status
- **Create user**: On new user purchase — creates user with `is_premium`, `role`, `whitelabel_id`
- **Update user**: On existing user purchase — updates role/premium/whitelabel

## Notes
- `active` field on user determines if subscription renewals are processed
- `API_MASTER_TOKEN` is used for admin-level operations (create/update user)
- Billing does not own user records — it only writes what the product config dictates
