import { describe, it, expect, beforeEach, vi } from "vitest"

/**
 * Route tests for the test mode rule on POST /purchase/new and POST /purchase/existing.
 *
 * Test mode sends the charge to the Square sandbox, so it is allowed only for a buyer on the test
 * email domain or a caller with payments_test_mode. A refusal must be a 403 TEST_MODE_NOT_ALLOWED
 * before any card or charge work, which here means the purchase use case is never called.
 *
 * /purchase/existing runs through the real authMiddleware (only the token lookup is faked), so the
 * old bypass, where `mock_purchase` in the body forced test mode after the middleware had
 * authorized, is tested end to end.
 */

const users = vi.hoisted(() => ({ byToken: {} as Record<string, any> }))

vi.mock("@api/utils/getUserFromToken", () => ({
  getUserFromToken: vi.fn(async (token: string) => users.byToken[token] ?? null),
  getUserById: vi.fn(async () => null),
}))
vi.mock("@api/infrastructure/logging/logging-context-store", () => ({ getLoggingContext: vi.fn(() => null) }))
vi.mock("@api/lib/services", () => ({ userApiClient: { getUser: vi.fn(async () => ({ id: 42 })) } }))
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

const newUseCase = vi.mocked(purchaseNewUserUseCase.execute)
const existingUseCase = vi.mocked(purchaseExistingUserUseCase.execute)

const success = {
  success: true,
  data: {
    subscriptionId: 1,
    userId: 42,
    productId: 122,
    amount: 4900,
    userCreated: true,
    userProvisioned: true,
    proratedCharge: null,
  },
} as any

function makeUser(token: string, email: string, capabilities: string[] = []) {
  users.byToken[token] = { user_id: 42, email, name: "U", role: "AGENT", active: 1, whitelabel_id: 7, capabilities }
}

async function postNew(body: Record<string, unknown>, init: { query?: string; headers?: Record<string, string> } = {}) {
  return purchaseRoutes.request(`/new${init.query ?? ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    body: JSON.stringify({ product_id: 122, email: "buyer@example.com", phone: "5555550100", name: "Buyer", ...body }),
  })
}

async function postExisting(
  token: string,
  body: Record<string, unknown>,
  init: { query?: string; headers?: Record<string, string> } = {}
) {
  return purchaseRoutes.request(`/existing${init.query ?? ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-token": token, ...(init.headers ?? {}) },
    body: JSON.stringify({ product_id: 122, ...body }),
  })
}

async function expectRefused(res: Response) {
  expect(res.status).toBe(403)
  expect(await res.json()).toMatchObject({ success: "error", code: "TEST_MODE_NOT_ALLOWED" })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  users.byToken = {}
  newUseCase.mockResolvedValue(success)
  existingUseCase.mockResolvedValue(success)
  makeUser("regular", "agent@example.com")
  makeUser("tester", "demo@test.cashoffers.com")
  makeUser("capable", "qa@example.com", ["payments_test_mode"])
})

describe("POST /purchase/new", () => {
  it("refuses mock_purchase for an ordinary email: 403, nothing charged, logged", async () => {
    await expectRefused(await postNew({ mock_purchase: true, card_token: "cnon:card-nonce-ok" }))
    expect(newUseCase).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith(
      "[TEST MODE REFUSED]",
      expect.objectContaining({ requestedBy: ["mock_purchase"] })
    )
  })

  it("refuses the test_mode query parameter for an ordinary email", async () => {
    await expectRefused(await postNew({}, { query: "?test_mode=true" }))
    expect(newUseCase).not.toHaveBeenCalled()
  })

  it("refuses the X-Test-Mode header for an ordinary email", async () => {
    await expectRefused(await postNew({}, { headers: { "X-Test-Mode": "true" } }))
    expect(newUseCase).not.toHaveBeenCalled()
  })

  it("allows mock_purchase for an @test.cashoffers.com buyer and runs the sandbox", async () => {
    const res = await postNew({
      email: "demo@test.cashoffers.com",
      mock_purchase: true,
      card_token: "cnon:card-nonce-ok",
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as any).environment).toBe("sandbox")
    expect(newUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ context: expect.objectContaining({ testMode: true }) })
    )
    expect(console.log).toHaveBeenCalledWith("[TEST MODE ACTIVATED]", expect.anything())
  })

  it("charges production normally when nothing asks for test mode", async () => {
    const res = await postNew({ card_token: "cnon:real" })
    expect(res.status).toBe(200)
    expect(((await res.json()) as any).environment).toBe("production")
    expect(newUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ context: expect.objectContaining({ testMode: false }) })
    )
  })
})

describe("POST /purchase/existing", () => {
  it("refuses the mock_purchase bypass for a signed-in user without the capability", async () => {
    await expectRefused(await postExisting("regular", { mock_purchase: true, card_token: "cnon:card-nonce-ok" }))
    expect(existingUseCase).not.toHaveBeenCalled()
  })

  it("refuses the test_mode query parameter for a user without the capability", async () => {
    await expectRefused(await postExisting("regular", {}, { query: "?test_mode=true" }))
    expect(existingUseCase).not.toHaveBeenCalled()
  })

  it("refuses the X-Test-Mode header for a user without the capability", async () => {
    await expectRefused(await postExisting("regular", {}, { headers: { "X-Test-Mode": "true" } }))
    expect(existingUseCase).not.toHaveBeenCalled()
  })

  it("allows mock_purchase for an @test.cashoffers.com user", async () => {
    const res = await postExisting("tester", { mock_purchase: true })
    expect(res.status).toBe(200)
    expect(((await res.json()) as any).environment).toBe("sandbox")
    expect(existingUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ context: expect.objectContaining({ testMode: true }) })
    )
  })

  it("allows mock_purchase for a user with payments_test_mode", async () => {
    const res = await postExisting("capable", { mock_purchase: true })
    expect(res.status).toBe(200)
    expect(existingUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ context: expect.objectContaining({ testMode: true }) })
    )
  })

  it("allows the X-Test-Mode header for a user with payments_test_mode", async () => {
    const res = await postExisting("capable", {}, { headers: { "X-Test-Mode": "true" } })
    expect(res.status).toBe(200)
    expect(existingUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ context: expect.objectContaining({ testMode: true }) })
    )
  })

  it("charges production for an ordinary user who asks for nothing", async () => {
    const res = await postExisting("regular", {})
    expect(res.status).toBe(200)
    expect(((await res.json()) as any).environment).toBe("production")
    expect(existingUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ context: expect.objectContaining({ testMode: false }) })
    )
  })
})
