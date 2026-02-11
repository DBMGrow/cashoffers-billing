import type { MiddlewareHandler } from "hono"
import { getUserFromToken, getUserById } from "@/utils/getUserFromToken"
import { TestModeDetector } from "@/infrastructure/payment/test-mode-detector"
import { TestModeAuthorizer } from "@/infrastructure/payment/test-mode-authorizer"

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
    // Extract API token from headers
    const apiToken = c.req.header("x-api-token")

    if (!apiToken) {
      return c.json({
        success: "error",
        error: "0000B: Unauthorized - API token required"
      }, 401)
    }

    // Get token owner from database
    const tokenOwner = await getUserFromToken(apiToken)

    if (!tokenOwner) {
      return c.json({
        success: "error",
        error: "0000D: Unauthorized - Invalid API token"
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
        error: "0000C: User not found"
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
          error: "0000F: Unauthorized - Insufficient permissions"
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
    })

    c.set("token_owner", {
      user_id: tokenOwner.user_id,
      email: tokenOwner.email,
      name: tokenOwner.name,
      role: tokenOwner.role,
      active: tokenOwner.active,
      capabilities: tokenOwner.capabilities,
    })

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
