import type { Context, MiddlewareHandler } from "hono"
import getUser from "../../utils/getUser"

interface AuthOptions {
  allowSelf?: boolean
}

/**
 * Hono auth middleware factory
 * Checks user permissions and attaches user data to context
 */
export function authMiddleware(
  permissions: string | string[] | null,
  options?: AuthOptions
): MiddlewareHandler {
  const perms = permissions
    ? Array.isArray(permissions)
      ? permissions
      : [permissions]
    : null
  const { allowSelf = false } = options || {}

  return async (c, next) => {
    let user_id: string | null = null

    // Extract user_id based on request method
    const method = c.req.method
    switch (method) {
      case "GET":
        user_id = c.req.param("user_id") || c.req.query("user_id") || null
        break
      case "POST":
      case "PUT": {
        const body = await c.req.json().catch(() => ({}))
        user_id = body?.user_id || null
        break
      }
    }

    // Handle allowSelf
    if (allowSelf && !user_id) {
      // Create a mock Express request object for getUser compatibility
      const mockReq = createMockRequest(c)
      const self_user_id = await getUser(mockReq, null, { allowSelf: true })
      if (self_user_id?.success === "success") {
        user_id = self_user_id?.user_id
      } else {
        return c.json({
          success: "error",
          error: "0000Z: Unauthorized" + JSON.stringify(self_user_id),
        })
      }
    }

    // Get user data
    const mockReq = createMockRequest(c)
    const user = await getUser(mockReq, user_id)
    if (user?.success !== "success") {
      return c.json({
        success: "error",
        data: user,
        error: "A000",
        user_id,
        method,
      })
    }

    // Get token owner
    const token_owner = await getUser(mockReq, user?.user_id)
    if (token_owner.success !== "success") {
      return c.json({ success: "error", data: token_owner, error: "A001" })
    }

    // Check authorization
    const authCheck = user?.success === "success" && user?.data?.user_id == user_id

    // Check permissions
    const tokenOwnerCaps = token_owner?.data?.capabilities || []
    let permissionsCheck = true
    if (perms) {
      permissionsCheck = perms.every((permission) => tokenOwnerCaps.includes(permission))
    }

    if (!authCheck) {
      return c.json({ success: "error", error: "0000E: Unauthorized" })
    }
    if (!permissionsCheck) {
      return c.json({ success: "error", error: "0000F: Unauthorized" })
    }

    // Attach user data to context
    c.set("user", user?.data)
    c.set("token_owner", token_owner?.data)

    await next()
  }
}

/**
 * Create a mock Express request object for compatibility with existing utils
 * This is a temporary bridge until we migrate getUser to work with Hono context
 */
function createMockRequest(c: Context): any {
  return {
    headers: Object.fromEntries(c.req.raw.headers.entries()),
    cookies: c.req.header("cookie"),
    get: (header: string) => c.req.header(header),
  }
}
