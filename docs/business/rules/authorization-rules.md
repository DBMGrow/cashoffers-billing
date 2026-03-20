# Rule: Authorization Rules

## Definition
Every API request is authenticated against the main CashOffers API. Access to resources is controlled by capability strings and ownership.

## Rules

1. All requests (except health check) must include a valid JWT token.
2. The token is validated against the main API (`API_ROUTE_AUTH` or `API_ROUTE_AUTH_V2`).
3. User data (including permissions) is fetched from the main API on each request.
4. Access to a resource requires either:
   - The user has the required permission string (e.g., `"payments_create"`), OR
   - The route uses `allowSelf: true` AND the token owner matches the resource owner
5. Admins can act on behalf of any user (token owner ≠ resource owner is allowed for admins).
6. The `CRON_SECRET` header is required for cron endpoints — no user token needed.

## Permission Examples
- `payments_create` — can create payments
- `subscriptions_manage` — can manage subscriptions
- `products_admin` — can create/edit products

## Where Enforced
- `api/lib/middleware/authMiddleware.ts`
- `api/utils/userCan.ts`
- Individual route handlers that check `allowSelf`

## Missing Enforcement
- Permission strings are not fully documented — the canonical list lives in the main API, not here.
- Some routes may have inconsistent permission checks — needs audit.
