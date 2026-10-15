import { describe, it, expect, beforeEach, vi } from "vitest"

/**
 * The set-password token on the purchase response (#1421).
 *
 * The signup page redirects to the dashboard's /login/welcome?token=... only when the response
 * carries `data.user.reset_token`. The main API's GET /users/:id strips credentials, so the route
 * must use the token the new-user use case generated, and only for the user that request created.
 * An existing user's purchase never carries a token.
 */

const users = vi.hoisted(() => ({ byToken: {} as Record<string, any> }))

vi.mock("@api/utils/getUserFromToken", () => ({
  getUserFromToken: vi.fn(async (token: string) => users.byToken[token] ?? null),
  getUserById: vi.fn(async () => null),
}))
vi.mock("@api/infrastructure/logging/logging-context-store", () => ({ getLoggingContext: vi.fn(() => null) }))
vi.mock("@api/lib/services", () => ({
  userApiClient: { getUser: vi.fn(async (id: number) => ({ id, email: "buyer@example.com" })) },
}))
vi.mock("@api/lib/repositories", () => ({
  productRepository: { findById: vi.fn(async () => ({ product_id: 122 })) },
  userCardRepository: { findByUserId: vi.fn(async () => []) },
  promoCodeRepository: {},
}))
vi.mock("@api/use-cases/subscription", () => ({
  purchaseNewUserUseCase: { execute: vi.fn() },
  purchaseExistingUserUseCase: { execute: vi.fn() },
}))
vi.mock("../manage/linked-product", () => ({ guardPurchaseWhitelabel: vi.fn(async () => null) }))
vi.mock("@api/config/config.service", () => ({
  config: { jwtSecret: "test", nodeEnv: "test", api: { url: "http://api.test", key: "k", masterToken: "m" } },
}))

import { purchaseRoutes } from "./routes"
import { purchaseNewUserUseCase, purchaseExistingUserUseCase } from "@api/use-cases/subscription"
import { userApiClient } from "@api/lib/services"

const newUseCase = vi.mocked(purchaseNewUserUseCase.execute)
const existingUseCase = vi.mocked(purchaseExistingUserUseCase.execute)
const getUser = vi.mocked(userApiClient.getUser)

function result(data: Record<string, unknown>) {
  return {
    success: true,
    data: {
      subscriptionId: 1,
      userId: 42,
      productId: 122,
      amount: 4900,
      userCreated: true,
      userProvisioned: true,
      proratedCharge: null,
      ...data,
    },
  } as any
}

async function postNew() {
  return purchaseRoutes.request("/new", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_id: 122, email: "buyer@example.com", phone: "5555550100", name: "Buyer" }),
  })
}

async function postExisting() {
  return purchaseRoutes.request("/existing", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-token": "regular" },
    body: JSON.stringify({ product_id: 122 }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  users.byToken = {
    regular: {
      user_id: 42,
      email: "agent@example.com",
      name: "U",
      role: "AGENT",
      active: 1,
      whitelabel_id: 7,
      capabilities: [],
    },
  }
})

describe("POST /purchase/new: the set-password token", () => {
  it("carries the token the use case generated for the user it created", async () => {
    newUseCase.mockResolvedValue(result({ resetToken: "tok-generated-here" }))

    const res = await postNew()
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.data.user.reset_token).toBe("tok-generated-here")
    expect(body.data.user.id).toBe(42)
  })

  it("uses the generated token even if the user API were to return a different one", async () => {
    newUseCase.mockResolvedValue(result({ resetToken: "tok-generated-here" }))
    getUser.mockResolvedValueOnce({ id: 42, email: "buyer@example.com", reset_token: "tok-from-api" } as any)

    const body = (await (await postNew()).json()) as any
    expect(body.data.user.reset_token).toBe("tok-generated-here")
  })

  it("has no user and no token when provisioning was deferred", async () => {
    newUseCase.mockResolvedValue(result({ userId: null, userCreated: false, userProvisioned: false, resetToken: null }))

    const body = (await (await postNew()).json()) as any
    expect(body.data.user).toBeNull()
    expect(getUser).not.toHaveBeenCalled()
  })
})

describe("POST /purchase/existing: no set-password token", () => {
  it("carries no token, even if the user API returns one", async () => {
    existingUseCase.mockResolvedValue(result({ userCreated: false }))
    getUser.mockResolvedValueOnce({ id: 42, email: "agent@example.com", reset_token: "tok-from-api" } as any)

    const res = await postExisting()
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.data.user.id).toBe(42)
    expect(body.data.user).not.toHaveProperty("reset_token")
  })
})
