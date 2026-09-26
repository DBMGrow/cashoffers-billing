import { describe, it, expect, vi } from "vitest"
import { isUserFacingError, publishPurchaseEvents } from "./purchase-helpers"
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

describe("publishPurchaseEvents productData", () => {
  const baseParams = {
    purchaseRequestId: 1,
    purchaseRequestUuid: "uuid",
    userId: 42,
    email: "guest@exp.test",
    product: { product_id: 70, product_name: "Express Offers Pro" },
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

  // The account half of the dashboard's upgrade link: an Express Offers Guest who buys Express
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
})
