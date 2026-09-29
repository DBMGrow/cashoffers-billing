import { describe, it, expect, vi } from "vitest"
import { calculatePricing, isUserFacingError, publishPurchaseEvents } from "./purchase-helpers"
import { CashOffersAccountHandler } from "@api/application/service-handlers/cashoffers/cashoffers-account.handler"

describe("isUserFacingError", () => {
  it("treats TRANSACTION_LIMIT as a user-facing card decline (not a system error)", () => {
    // Square classifies TRANSACTION_LIMIT as a non-critical card decline, so the
    // purchase flow must surface it as a declined payment (HTTP 400, no developer
    // system-error alert), matching the renewal flow and the error translator.
    expect(isUserFacingError("TRANSACTION_LIMIT")).toBe(true)
  })

  it("keeps other card-decline codes user-facing", () => {
    expect(isUserFacingError("CARD_DECLINED")).toBe(true)
    expect(isUserFacingError("INSUFFICIENT_FUNDS")).toBe(true)
    expect(isUserFacingError("EXPIRED_CARD")).toBe(true)
  })

  it("does not treat critical/unknown codes as user-facing", () => {
    expect(isUserFacingError("UNAUTHORIZED")).toBe(false)
    expect(isUserFacingError("PURCHASE_ERROR")).toBe(false)
    expect(isUserFacingError(undefined)).toBe(false)
  })
})

describe("calculatePricing", () => {
  // Staging rows, as they are: KW Individual (product 1) and ExpressOffers Pro (product 70).
  const kwIndividual = { product: { price: 25000 }, data: { duration: "monthly" as const, renewal_cost: 25000 } }
  const expPro = { product: { price: 4900 }, data: { duration: "monthly" as const, renewal_cost: 4900, hidden: true } }

  it("charges a new signup price as the signup fee plus the first period (KW, unchanged)", () => {
    expect(calculatePricing(kwIndividual.product, kwIndividual.data)).toEqual({
      signupFee: 25000,
      renewalCost: 25000,
      productDuration: "monthly",
      initialAmount: 50000,
    })
  })

  // CO-I271 F-S4-e (AC21): an existing Guest enrolling in product 70 through
  // /manage?goto=enrollment&product=70 was quoted "$49.00 / month" and charged 9800.
  it("charges an existing user the first period once, not price on top of it", () => {
    expect(calculatePricing(expPro.product, expPro.data, { existingUser: true })).toEqual({
      signupFee: 0,
      renewalCost: 4900,
      productDuration: "monthly",
      initialAmount: 4900,
    })
  })

  it("still charges an existing user an explicit data.signup_fee", () => {
    expect(
      calculatePricing({ price: 4900 }, { renewal_cost: 4900, signup_fee: 1000 }, { existingUser: true }).initialAmount
    ).toBe(5900)
  })

  it("falls back to price as the period cost for an existing user when renewal_cost is unset", () => {
    expect(calculatePricing({ price: 4900 }, {}, { existingUser: true }).initialAmount).toBe(4900)
  })

  it("keeps a free product free for an existing user", () => {
    expect(
      calculatePricing({ price: 0 }, { renewal_cost: 0, signup_fee: 0 }, { existingUser: true }).initialAmount
    ).toBe(0)
  })
})

describe("publishPurchaseEvents productData", () => {
  const baseParams = {
    purchaseRequestId: 1,
    purchaseRequestUuid: "uuid",
    userId: 42,
    email: "guest@exp.test",
    product: { product_id: 70, product_name: "ExpressOffers Pro" },
    subscription: { subscription_id: 9, renewal_date: null },
    transaction: { transaction_id: 3 },
    pricing: { signupFee: 0, renewalCost: 4900, productDuration: "monthly", initialAmount: 4900 },
    payment: null,
    cardIdString: null,
    userCard: null,
    userWasCreated: false,
    startTime: new Date(),
  }
  const expProData = {
    cashoffers: { managed: true, user_config: { role: "AGENT" as const, role_v2: "AGENT_EXP_PRO" as const } },
  }

  function makeDeps() {
    const published: any[] = []
    return {
      published,
      deps: {
        eventBus: { publish: vi.fn(async (e: any) => void published.push(e)) } as any,
        purchaseRequestRepository: { markAsCompleted: vi.fn() } as any,
      },
    }
  }

  it("attaches productData as SubscriptionCreated metadata when given", async () => {
    const { deps, published } = makeDeps()
    await publishPurchaseEvents(deps, { ...baseParams, productData: expProData })
    const created = published.find((e) => e.eventType === "SubscriptionCreated")
    expect(created.metadata).toEqual({ productData: expProData })
  })

  it("leaves metadata off when productData is not given (new-user flow)", async () => {
    const { deps, published } = makeDeps()
    await publishPurchaseEvents(deps, baseParams)
    const created = published.find((e) => e.eventType === "SubscriptionCreated")
    expect(created.metadata).toBeUndefined()
  })

  // The account half of the dashboard's upgrade link: an ExpressOffers Guest who buys Express
  // Offers Pro through the manage flow must end up on AGENT_EXP_PRO. Before productData rode on
  // the event the handler returned at `!productData?.cashoffers?.managed` and wrote nothing.
  it("lets CashOffersAccountHandler move an existing Guest to the product's role_v2", async () => {
    const { deps, published } = makeDeps()
    await publishPurchaseEvents(deps, { ...baseParams, productData: expProData })
    const created = published.find((e) => e.eventType === "SubscriptionCreated")

    const userApiClient = {
      getUser: vi.fn(async () => ({
        user_id: 42,
        role: "AGENT",
        role_v2: "AGENT_EXP_GUEST",
        is_premium: 0,
        whitelabel_id: 7,
      })),
      updateUser: vi.fn(async () => ({})),
      createUser: vi.fn(),
    }
    const handler = new CashOffersAccountHandler(
      userApiClient as any,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
      { findById: vi.fn(async () => ({ product_id: 70, whitelabel_code: "EXP" })) } as any,
      { findByCode: vi.fn(async () => ({ whitelabel_id: 7 })) } as any
    )
    await handler.handle(created)

    expect(userApiClient.createUser).not.toHaveBeenCalled()
    expect(userApiClient.updateUser).toHaveBeenCalledWith(42, { role_v2: "AGENT_EXP_PRO", whitelabel_id: 7 })
  })

  // Every managed product names a role, so every managed purchase writes one. A product that still
  // carries only the legacy half writes the role_v2 that half derives to; the main API's role
  // endpoint then derives role and the tier bits from it in the same statement.
  it.each([
    [{ role: "AGENT" as const, is_premium: 1 as const }, "AGENT_PREMIUM"],
    [{ role: "TEAMOWNER" as const, is_premium: 1 as const }, "TEAMOWNER"],
    [{ role: "AGENT" as const, role_v2: "AGENT_EXP_ELITE" as const }, "AGENT_EXP_ELITE"],
  ])("writes role_v2 for a managed product with user_config %o", async (userConfig, expected) => {
    const { deps, published } = makeDeps()
    await publishPurchaseEvents(deps, {
      ...baseParams,
      productData: { cashoffers: { managed: true, user_config: userConfig } },
    })
    const created = published.find((e) => e.eventType === "SubscriptionCreated")

    const userApiClient = {
      getUser: vi.fn(async () => ({
        user_id: 42,
        role: "AGENT",
        role_v2: "AGENT_FREE",
        is_premium: 0,
        whitelabel_id: 7,
      })),
      updateUser: vi.fn(async () => ({})),
      createUser: vi.fn(),
    }
    const handler = new CashOffersAccountHandler(
      userApiClient as any,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
      { findById: vi.fn(async () => ({ product_id: 70, whitelabel_code: "EXP" })) } as any,
      { findByCode: vi.fn(async () => ({ whitelabel_id: 7 })) } as any
    )
    await handler.handle(created)

    expect(userApiClient.updateUser).toHaveBeenCalledWith(42, { role_v2: expected, whitelabel_id: 7 })
  })
})
