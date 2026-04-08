import { describe, it, expect, beforeEach, vi } from "vitest"
import { Hono } from "hono"
import { authMiddleware } from "./authMiddleware"

// Mock the database-dependent functions
vi.mock("@api/utils/getUserFromToken", () => ({
  getUserFromToken: vi.fn(),
  getUserById: vi.fn(),
}))

vi.mock("@api/infrastructure/logging/logging-context-store", () => ({
  getLoggingContext: vi.fn(() => ({ userId: null })),
}))

import { getUserFromToken, getUserById } from "@api/utils/getUserFromToken"

const mockGetUserFromToken = vi.mocked(getUserFromToken)
const mockGetUserById = vi.mocked(getUserById)

const adminUser = {
  user_id: 1,
  email: "admin@cashoffers.com",
  name: "Admin",
  role: "ADMIN",
  active: 1,
  api_token: "admin_token",
  capabilities: ["payments_create", "payments_read_all", "payments_delete_all"],
}

const regularUser = {
  user_id: 2,
  email: "user@cashoffers.com",
  name: "User",
  role: "AGENT",
  active: 1,
  api_token: "user_token",
  capabilities: [],
}

const targetUser = {
  user_id: 5,
  email: "target@cashoffers.com",
  name: "Target",
  role: "AGENT",
  active: 1,
  api_token: null,
}

/**
 * Creates a test Hono app with the authMiddleware and a simple success handler
 */
function makeApp(permissions: string | string[] | null = null) {
  const app = new Hono()
  app.get(
    "/protected",
    authMiddleware(permissions),
    (c) => c.json({ success: true, user: c.get("user" as any), token_owner: c.get("token_owner" as any) })
  )
  app.post(
    "/protected",
    authMiddleware(permissions),
    async (c) => {
      const body = await c.req.json().catch(() => ({}))
      return c.json({ success: true, user: c.get("user" as any), body })
    }
  )
  app.delete(
    "/protected/:user_id?",
    authMiddleware(permissions),
    (c) => c.json({ success: true })
  )
  return app
}

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Token Extraction", () => {
    it("should return 401 when no API token is provided", async () => {
      const app = makeApp(null)
      const res = await app.request("/protected")

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.ref).toBe("0000B")
    })

    it("should accept token from x-api-token header", async () => {
      mockGetUserFromToken.mockResolvedValue(adminUser)

      const app = makeApp(null)
      const res = await app.request("/protected", {
        headers: { "x-api-token": "admin_token" },
      })

      expect(res.status).toBe(200)
    })

    it("should accept token from _api_token cookie", async () => {
      mockGetUserFromToken.mockResolvedValue(adminUser)

      const app = makeApp(null)
      const res = await app.request("/protected", {
        headers: { Cookie: "_api_token=admin_token" },
      })

      expect(res.status).toBe(200)
    })

    it("should prioritize header token over cookie token", async () => {
      mockGetUserFromToken.mockResolvedValue(adminUser)

      const app = makeApp(null)
      await app.request("/protected", {
        headers: {
          "x-api-token": "header_token",
          Cookie: "_api_token=cookie_token",
        },
      })

      expect(mockGetUserFromToken).toHaveBeenCalledWith("header_token")
    })
  })

  describe("Token Validation", () => {
    it("should return 401 when token is invalid (user not found)", async () => {
      mockGetUserFromToken.mockResolvedValue(null)

      const app = makeApp(null)
      const res = await app.request("/protected", {
        headers: { "x-api-token": "invalid_token" },
      })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.ref).toBe("0000D")
    })
  })

  describe("Permission Checks", () => {
    it("should allow request when no permissions required", async () => {
      mockGetUserFromToken.mockResolvedValue(regularUser)

      const app = makeApp(null)
      const res = await app.request("/protected", {
        headers: { "x-api-token": "user_token" },
      })

      expect(res.status).toBe(200)
    })

    it("should allow request when user has required single permission", async () => {
      mockGetUserFromToken.mockResolvedValue(adminUser)

      const app = makeApp("payments_create")
      const res = await app.request("/protected", {
        headers: { "x-api-token": "admin_token" },
      })

      expect(res.status).toBe(200)
    })

    it("should deny request when user lacks required permission", async () => {
      mockGetUserFromToken.mockResolvedValue(regularUser) // no capabilities

      const app = makeApp("payments_create")
      const res = await app.request("/protected", {
        headers: { "x-api-token": "user_token" },
      })

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.ref).toBe("0000F")
    })

    it("should require ALL permissions when array provided", async () => {
      mockGetUserFromToken.mockResolvedValue(adminUser)

      const app = makeApp(["payments_create", "payments_read_all"])
      const res = await app.request("/protected", {
        headers: { "x-api-token": "admin_token" },
      })

      expect(res.status).toBe(200)
    })

    it("should deny when user has only some of required array permissions", async () => {
      const partialUser = {
        ...adminUser,
        capabilities: ["payments_create"], // missing payments_read_all
      }
      mockGetUserFromToken.mockResolvedValue(partialUser)

      const app = makeApp(["payments_create", "payments_read_all"])
      const res = await app.request("/protected", {
        headers: { "x-api-token": "admin_token" },
      })

      expect(res.status).toBe(403)
    })
  })

  describe("Context Population", () => {
    it("should attach token_owner to context", async () => {
      mockGetUserFromToken.mockResolvedValue(adminUser)

      const app = makeApp(null)
      const res = await app.request("/protected", {
        headers: { "x-api-token": "admin_token" },
      })

      const body = await res.json()
      expect(body.token_owner.user_id).toBe(1)
      expect(body.token_owner.email).toBe("admin@cashoffers.com")
      expect(body.token_owner.capabilities).toContain("payments_create")
    })

    it("should set user to token_owner when no user_id in request", async () => {
      mockGetUserFromToken.mockResolvedValue(adminUser)

      const app = makeApp(null)
      const res = await app.request("/protected", {
        headers: { "x-api-token": "admin_token" },
      })

      const body = await res.json()
      expect(body.user.user_id).toBe(1) // Same as token_owner
    })
  })

  describe("Target User Resolution", () => {
    it("should resolve target user from user_id in POST body", async () => {
      mockGetUserFromToken.mockResolvedValue(adminUser)
      mockGetUserById.mockResolvedValue(targetUser)

      const app = makeApp(null)
      const res = await app.request("/protected", {
        method: "POST",
        headers: {
          "x-api-token": "admin_token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: 5 }),
      })

      expect(res.status).toBe(200)
      expect(mockGetUserById).toHaveBeenCalledWith(5)
    })

    it("should resolve target user from user_id query param in GET", async () => {
      mockGetUserFromToken.mockResolvedValue(adminUser)
      mockGetUserById.mockResolvedValue(targetUser)

      const app = makeApp(null)
      const res = await app.request("/protected?user_id=5", {
        headers: { "x-api-token": "admin_token" },
      })

      expect(res.status).toBe(200)
      expect(mockGetUserById).toHaveBeenCalledWith(5)
    })

    it("should return 404 when target user is not found", async () => {
      mockGetUserFromToken.mockResolvedValue(adminUser)
      mockGetUserById.mockResolvedValue(null)

      const app = makeApp(null)
      const res = await app.request("/protected", {
        method: "POST",
        headers: {
          "x-api-token": "admin_token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: 999 }),
      })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.ref).toBe("0000C")
    })
  })
})
