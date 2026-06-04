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

## SSO / Account-Management Links
The main system generates one-click links into the billing `/manage` page so users
can manage billing without re-authenticating.

- **URL shape**: `https://account.cashoffers.pro/manage?t=<jwt>` (main system).
  Internal dev links from `auth-link <user_id>` use `?token=<jwt>`. The frontend
  accepts either param.
- **Token**: HS256 JWT signed with the shared `JWT_SECRET`. Two payload shapes are
  supported by `GET /auth/jwt/verify/:token`:
  - `{ email }` — main-system SSO links. Billing resolves the email to the user's
    `api_token` (`getApiTokenByEmail`).
  - `{ api_token }` — internal dev links (`auth-link`), api_token embedded directly.
- **Result**: verify resolves the user, sets the `_api_token` session cookie, and the
  `/manage` flow picks up the session.
- **Requirement**: `JWT_SECRET` in this service MUST match the main system's signing
  secret, or `jwt.verify` fails with `invalid signature` and the link won't log in.

## Notes
- `active` field on user determines if subscription renewals are processed
- `API_MASTER_TOKEN` is used for admin-level operations (create/update user)
- Billing does not own user records — it only writes what the product config dictates
