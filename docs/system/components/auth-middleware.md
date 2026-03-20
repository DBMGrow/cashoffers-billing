# Component: Auth Middleware

## What It Does
Validates every incoming API request by verifying the JWT token against the main CashOffers API. Attaches user data to the request context.

## Key Files
- `api/lib/middleware/authMiddleware.ts`
- `api/utils/userCan.ts` — permission checking helper

## How It Works
1. Extract Bearer token from `Authorization` header
2. Call main API (`API_ROUTE_AUTH` or `API_ROUTE_AUTH_V2`) with the token
3. On success: attach user data + permissions to Hono context
4. On failure: return 401

## Permission Check Options
- `permission: "payments_create"` — require specific capability string
- `allowSelf: true` — allow users to access their own resources (token owner = resource owner)
- Admin users can always access any resource

## Exemptions
- `/api/health` — no auth required
- `/api/cron/**` — uses `CRON_SECRET` header instead
- `/api/webhooks/**` — uses webhook secret instead

## Inputs
- HTTP `Authorization: Bearer <token>` header
- Main API user endpoint

## Outputs
- Hono context enriched with `user` and `permissions`
- 401 response on invalid token

## Failure Modes
- Main API is down → all authenticated requests fail
- Token expired → 401
- Missing permission → 403

## Gaps vs Intended Behavior
- Canonical list of permission strings lives in main API — not documented here. See [Authorization Rules](../../business/rules/authorization-rules).
