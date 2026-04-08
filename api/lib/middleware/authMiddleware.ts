import type { MiddlewareHandler } from "hono"
import { getCookie } from "hono/cookie"
import { getUserFromToken, getUserById } from "@api/utils/getUserFromToken"
import { TestModeDetector } from "@api/infrastructure/payment/test-mode-detector"
import { TestModeAuthorizer } from "@api/infrastructure/payment/test-mode-authorizer"
import { getLoggingContext } from "@api/infrastructure/logging/logging-context-store"

// Initialize test mode services (singleton instances)
const testModeDetector = new TestModeDetector()
const testModeAuthorizer = new TestModeAuthorizer()

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

    // Detect and authorize test mode (for payment operations)
    try {
      const paymentContext = testModeDetector.detectTestMode(c, {
        user_id: tokenOwner.user_id,
        email: tokenOwner.email,
        capabilities: tokenOwner.capabilities,
      })

      // Authorize test mode if requested
      testModeAuthorizer.authorize({
        capabilities: tokenOwner.capabilities,
      }, paymentContext.testMode)

      // Attach payment context to Hono context for use in routes
      c.set("paymentContext", paymentContext)

      // Log test mode activation for audit trail
      if (paymentContext.testMode) {
        console.log('[TEST MODE ACTIVATED]', {
          userId: tokenOwner.user_id,
          email: tokenOwner.email,
          detectedFrom: paymentContext.metadata?.detectedFrom,
          timestamp: paymentContext.metadata?.timestamp,
        })
      }
    } catch (error) {
      // Test mode authorization failed
      return c.json({
        success: "error",
        error: error instanceof Error ? error.message : "Test mode authorization failed"
      }, 403)
    }

    await next()
  }
}
