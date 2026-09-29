import type { MiddlewareHandler } from "hono"
import { getCookie } from "hono/cookie"
import { getUserFromToken, getUserById } from "@api/utils/getUserFromToken"
import { resolvePaymentContext } from "@api/infrastructure/payment/test-mode-policy"
import { getLoggingContext } from "@api/infrastructure/logging/logging-context-store"

/**
 * Hono auth middleware factory
 * Authenticates requests using database lookups instead of API calls
 *
 * @param permissions - Required permission(s) or null for no permission check
 *
 * How it works:
 * 1. Extracts API token from request headers
 * 2. Looks up token owner from database (with roles/capabilities)
 * 3. If a user_id is provided in the request, validates that user exists
 * 4. Checks if token owner has required permissions
 * 5. Attaches both token_owner and user to context for route handlers
 *
 * The "user" in context is the target user (from user_id param/body)
 * The "token_owner" is the authenticated user making the request
 * If no user_id provided, both will be the same (token owner)
 */
/**
 * Capabilities that permit acting on behalf of ANOTHER user.
 *
 * Without this gate, `user_id` in the request body was enough to retarget any
 * route at any account: the middleware resolved the claimed user and handlers
 * then treated it as the authenticated one. Holding any of these means the
 * caller is already trusted with other people's billing data.
 */
const ACT_ON_BEHALF_CAPABILITIES = [
  "payments_create",
  "payments_read_all",
  "payments_delete",
  "payments_delete_all",
  "users_read_all",
  "users_update_all",
] as const

export function authMiddleware(
  permissions: string | string[] | null
): MiddlewareHandler {
  const perms = permissions
    ? Array.isArray(permissions)
      ? permissions
      : [permissions]
    : null

  return async (c, next) => {
    // Extract API token from headers or cookies
    // Priority: header first, then cookie
    const apiToken = c.req.header("x-api-token") || getCookie(c, "_api_token")

    if (!apiToken) {
      return c.json({
        success: "error",
        error: "Unauthorized - API token required",
        ref: "0000B",
      }, 401)
    }

    // Get token owner from database
    const tokenOwner = await getUserFromToken(apiToken)

    if (!tokenOwner) {
      return c.json({
        success: "error",
        error: "Unauthorized - Invalid API token",
        ref: "0000D",
      }, 401)
    }

    // Extract user_id from request (if provided)
    let targetUserId: number | null = null
    const method = c.req.method

    switch (method) {
      case "GET":
        const paramId = c.req.param("user_id")
        const queryId = c.req.query("user_id")
        targetUserId = paramId ? Number(paramId) : queryId ? Number(queryId) : null
        break
      case "POST":
      case "PUT":
      case "DELETE": {
        const body = await c.req.json().catch(() => ({}))
        targetUserId = body?.user_id ? Number(body.user_id) : null
        break
      }
    }

    // Targeting somebody else requires an elevated capability.
    //
    // `authMiddleware(null)` means "authenticated", never "authorised to act as
    // whoever the body claims". Before this check, any caller with a valid API
    // token could put `user_id` in the payload and have every downstream handler
    // — and `checkSubscriptionAuthorization` — treat that claimed identity as
    // the acting user, which made cancel/uncancel/downgrade and /manage/purchase
    // operable against other people's subscriptions.
    if (targetUserId != null && targetUserId !== tokenOwner.user_id) {
      const canActOnBehalf = ACT_ON_BEHALF_CAPABILITIES.some((cap) =>
        tokenOwner.capabilities.includes(cap)
      )

      if (!canActOnBehalf) {
        return c.json({
          success: "error",
          error: "Unauthorized - cannot act on behalf of another user",
          ref: "0000G",
        }, 403)
      }
    }

    // Determine the target user
    // If no user_id provided, token owner is the target user
    const user = targetUserId ? await getUserById(targetUserId) : tokenOwner

    if (!user) {
      return c.json({
        success: "error",
        error: "User not found",
        ref: "0000C",
      }, 404)
    }

    // Check permissions
    if (perms && perms.length > 0) {
      const hasPermissions = perms.every((permission) =>
        tokenOwner.capabilities.includes(permission)
      )

      if (!hasPermissions) {
        return c.json({
          success: "error",
          error: "Unauthorized - Insufficient permissions",
          ref: "0000F",
        }, 403)
      }
    }

    // Attach user data to context in legacy format for compatibility
    c.set("user", {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      active: user.active,
      whitelabel_id: (user as any).whitelabel_id,
    })

    c.set("token_owner", {
      user_id: tokenOwner.user_id,
      email: tokenOwner.email,
      name: tokenOwner.name,
      role: tokenOwner.role,
      active: tokenOwner.active,
      capabilities: tokenOwner.capabilities,
    })

    // Update logging context with authenticated user ID
    const loggingContext = getLoggingContext()
    if (loggingContext) {
      loggingContext.userId = tokenOwner.user_id
    }

    // Detect and authorize test mode (for payment operations). The buyer is the target user; the
    // capability comes from the caller. Routes that also read `mock_purchase` from the body must
    // run it through resolvePaymentContext again, since the middleware cannot see the body flag.
    const testMode = resolvePaymentContext(c, {
      buyerEmail: user.email,
      capabilities: tokenOwner.capabilities,
      userId: tokenOwner.user_id,
    })
    if (!testMode.allowed) {
      return c.json(testMode.body, testMode.status)
    }
    c.set("paymentContext", testMode.context)

    await next()
  }
}
