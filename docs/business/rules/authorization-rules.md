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

## Test Mode (Square sandbox)

A payment in test mode runs against the Square sandbox, and production has sandbox credentials configured, so a test-mode purchase gives a real paid account without real money. The rule:

1. Test mode is requested by any of: `?test_mode=true`, the `X-Test-Mode: true` header, `mock_purchase: true` in a purchase body, or a buyer email ending in `@test.cashoffers.com`.
2. It is **allowed only** when the buyer's email ends in `@test.cashoffers.com` (`TEST_MODE_EMAIL_DOMAIN`), or the authenticated caller has the `payments_test_mode` capability.
3. Otherwise the request is refused with `403` and code `TEST_MODE_NOT_ALLOWED` before any card or charge work. There is no silent fallback to a production charge (a mock purchase has skipped the card step and sent a sandbox nonce).
4. Every refusal logs `[TEST MODE REFUSED]`; every allowed test-mode request logs `[TEST MODE ACTIVATED]`.

The email-domain allowance exists so a purchase can be demoed in production with a sandbox card. Anyone can type such an address, so it confines sandbox purchases to recognisable test accounts rather than proving who the buyer is.

Enforced in one function, `resolvePaymentContext` in `api/infrastructure/payment/test-mode-policy.ts`, called by `authMiddleware` (every authenticated payment route: `/purchase/existing`, `/manage/purchase`, `/card`, `/payment`, `/property`) and by `POST /purchase/new` (no auth). `POST /purchase/existing` calls it a second time with `mock_purchase`, since the middleware cannot see the body.

## Permission Examples
- `payments_create` — can create payments
- `subscriptions_manage` — can manage subscriptions
- `products_admin` — can create/edit products
- `payments_test_mode`: can run any payment in test mode (Square sandbox)

## Where Enforced
- `api/lib/middleware/authMiddleware.ts`
- `api/infrastructure/payment/test-mode-policy.ts` (test mode)
- `api/utils/userCan.ts`
- Individual route handlers that check `allowSelf`

## Missing Enforcement
- Permission strings are not fully documented — the canonical list lives in the main API, not here.
- Some routes may have inconsistent permission checks — needs audit.
