import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import { setCookie, deleteCookie } from "hono/cookie"
import { LoginRoute, LogoutRoute, CheckAuthRoute, VerifyJwtRoute } from "./schemas"
import { authMiddleware } from "@api/lib/middleware/authMiddleware"
import { getUserFromToken } from "@api/utils/getUserFromToken"
import jwt from "jsonwebtoken"
import axios from "axios"
import { config } from "@api/config/config.service"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

/**
 * POST /auth/login
 * Proxies authentication to V2 API and forwards auth cookies
 */
app.openapi(LoginRoute, async (c) => {
  try {
    const body = c.req.valid("json")
    const { email, password } = body

    // Proxy login request to V2 auth API
    const response = await axios.post(
      `${config.api.url}/auth/login`,
      { email, password },
      {
        validateStatus: () => true, // Don't throw on any status code
      }
    )

    // Extract _api_token cookie from V2 response
    const setCookieHeader = response.headers["set-cookie"]
    if (setCookieHeader) {
      const cookieString = Array.isArray(setCookieHeader) ? setCookieHeader.join("; ") : setCookieHeader
      const apiTokenMatch = cookieString.match(/_api_token=([^;]+)/)
      if (apiTokenMatch) {
        const token = apiTokenMatch[1]
        // Set the cookie on our response
        setCookie(c, "_api_token", token, {
          httpOnly: true,
          secure: config.nodeEnv === "production",
          sameSite: "Lax",
          path: "/",
        })
      }
    }

    // Return success or error based on V2 API response
    if (response.status === 200 && response.data.success === "success") {
      return c.json(response.data, 200)
    } else {
      return c.json(
        {
          success: "error" as const,
          error: response.data.error || "Authentication failed",
        },
        400
      )
    }
  } catch (error: any) {
    return c.json(
      {
        success: "error" as const,
        error: error.message || "Authentication failed",
      },
      400
    )
  }
})

/**
 * GET /auth/jwt/verify/:token
 * Verifies a JWT token locally and returns the associated user
 */
app.openapi(VerifyJwtRoute, async (c) => {
  const { token } = c.req.valid("param")

  let payload: any
  try {
    payload = jwt.verify(token, config.jwtSecret)
  } catch {
    return c.json({ success: "error" as const, error: "Invalid or expired token" }, 401)
  }

  const apiToken: string | undefined = payload?.api_token
  if (!apiToken) {
    return c.json({ success: "error" as const, error: "Invalid token payload" }, 401)
  }

  const user = await getUserFromToken(apiToken)
  if (!user) {
    return c.json({ success: "error" as const, error: "User not found" }, 401)
  }

  return c.json({
    success: "success" as const,
    data: { ...user, name: user.name ?? undefined },
  }, 200)
})

/**
 * GET /auth/check
 * Returns current authenticated user based on session cookie
 */
app.use("/check", authMiddleware(null))
app.openapi(CheckAuthRoute, async (c) => {
  const user = c.get("user")
  return c.json({ success: "success" as const, data: user }, 200)
})

/**
 * POST /auth/logout
 * Clears authentication cookies
 */
app.openapi(LogoutRoute, async (c) => {
  // Clear the authentication cookie
  deleteCookie(c, "_api_token", {
    path: "/",
  })

  return c.json(
    {
      success: "success" as const,
      message: "Logged out successfully",
    },
    200
  )
})

export const authRoutes = app
