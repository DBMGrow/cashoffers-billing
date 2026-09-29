import { describe, it, expect, vi } from "vitest"
import { PurchaseExistingUserUseCase } from "./purchase-existing-user.use-case"

/**
 * CO-I271 F-S4-e (AC21). An existing Express Offers Guest enrolled in product 70 (price 4900,
 * data.renewal_cost 4900, monthly) through `/manage?goto=enrollment&product=70`, was quoted
 * "$49.00 / month" and charged 9800: `price` was read as a signup fee on top of the first period,
 * which is the new-signup rule. These tests pin the amount the existing-user flow sends to Square.
 */
function makeDeps(product: { product_id: number; product_name: string; price: number; data: unknown }) {
  const createPayment = vi.fn(async () => ({ id: "pay_1", status: "COMPLETED", environment: "sandbox" as const }))
  const deps = {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    paymentProvider: { createPayment },
    emailService: { sendEmail: vi.fn() },
    productRepository: { findById: vi.fn(async () => product) },
    subscriptionRepository: {
      findByUserId: vi.fn(async () => []),
      create: vi.fn(async () => ({ subscription_id: 9, renewal_date: null })),
    },
    userCardRepository: {
      findByUserId: vi.fn(async () => [{ card_id: "ccof:1" }]),
      findOne: vi.fn(async () => ({ card_id: "ccof:1", square_customer_id: "cust_1", last_4: "5100" })),
    },
    transactionRepository: { create: vi.fn(async () => ({ transaction_id: 3 })) },
    purchaseRequestRepository: {
      create: vi.fn(async () => ({ request_id: 1, request_uuid: "uuid" })),
      updateStatus: vi.fn(),
      markAsFailed: vi.fn(),
      markAsCompleted: vi.fn(),
    },
    homeUptickSubscriptionRepository: { create: vi.fn(), findByUserId: vi.fn(async () => null) },
    eventBus: { publish: vi.fn() },
    adminAlertEmail: "admin@test",
  }
  return { deps, createPayment }
}

const run = async (product: Parameters<typeof makeDeps>[0]) => {
  const { deps, createPayment } = makeDeps(product)
  const result = await new PurchaseExistingUserUseCase(deps as never).execute({
    userId: 999749,
    productId: product.product_id,
    email: "guest@exp.test",
  } as never)
  return { result, createPayment }
}

describe("PurchaseExistingUserUseCase charge amount", () => {
  it("charges Express Offers Pro its monthly price once (4900, not 9800)", async () => {
    const { result, createPayment } = await run({
      product_id: 70,
      product_name: "Express Offers Pro",
      price: 4900,
      data: {
        duration: "monthly",
        hidden: true,
        renewal_cost: 4900,
        cashoffers: { managed: true, user_config: { role: "AGENT", role_v2: "AGENT_EXP_PRO", is_premium: 0 } },
      },
    })
    expect(result.success).toBe(true)
    expect(createPayment).toHaveBeenCalledTimes(1)
    expect((createPayment.mock.calls[0] as any)[0].amountMoney.amount).toBe(BigInt(4900))
  })

  it("adds an explicit data.signup_fee", async () => {
    const { createPayment } = await run({
      product_id: 71,
      product_name: "Plan with a setup fee",
      price: 4900,
      data: { duration: "monthly", renewal_cost: 4900, signup_fee: 1000 },
    })
    expect((createPayment.mock.calls[0] as any)[0].amountMoney.amount).toBe(BigInt(5900))
  })
})

/**
 * CO-I271: a test account (@test.cashoffers.com) upgrades from the account site with Square's
 * sandbox nonce. With the test-mode context the route resolved, the card and the charge go to the
 * sandbox, the subscription records it, and the role write is requested exactly as for a real
 * purchase (SubscriptionCreated carries the product data CashOffersAccountHandler reads).
 */
describe("PurchaseExistingUserUseCase environment", () => {
  const pro = {
    product_id: 122,
    product_name: "ExpressOffers Pro",
    price: 4900,
    data: {
      duration: "monthly",
      renewal_cost: 4900,
      cashoffers: { managed: true, user_config: { role: "AGENT", role_v2: "AGENT_EXP_PRO", is_premium: 0 } },
    },
  }

  function fakeSquare(environment: "production" | "sandbox") {
    return {
      createCard: vi.fn(async () => ({
        id: `ccof:${environment}`,
        customerId: "cust_1",
        environment,
        cardBrand: "VISA",
        last4: "1111",
      })),
      createPayment: vi.fn(async () => ({ id: `pay_${environment}`, status: "COMPLETED", environment })),
    }
  }

  async function purchase(testMode: boolean) {
    const production = fakeSquare("production")
    const sandbox = fakeSquare("sandbox")
    const { deps } = makeDeps(pro)
    const logger = deps.logger
    const { DualEnvironmentPaymentProvider } = await import("@api/infrastructure/payment/dual-environment-provider")
    const allDeps = {
      ...deps,
      paymentProvider: new DualEnvironmentPaymentProvider(production as never, sandbox as never, logger as never),
      userCardRepository: {
        ...deps.userCardRepository,
        create: vi.fn(async (row: any) => row),
        findOne: vi.fn(async ({ card_id }: any) => ({ card_id, square_customer_id: "cust_1", last_4: "1111" })),
      },
    }
    const result = await new PurchaseExistingUserUseCase(allDeps as never).execute({
      userId: 999749,
      productId: 122,
      email: testMode ? "demo@test.cashoffers.com" : "agent@example.com",
      cardToken: "cnon:card-nonce-ok",
      expMonth: 12,
      expYear: 2027,
      cardholderName: "Demo",
      context: { testMode, source: "API", userId: 999749 },
    } as never)
    return { result, production, sandbox, deps: allDeps }
  }

  it("runs a test-mode purchase in the sandbox and records square_environment = sandbox", async () => {
    const { result, production, sandbox, deps } = await purchase(true)
    expect(result.success).toBe(true)
    expect(sandbox.createCard).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: "cnon:card-nonce-ok" }),
      expect.objectContaining({ testMode: true })
    )
    expect(sandbox.createPayment).toHaveBeenCalledTimes(1)
    expect(production.createCard).not.toHaveBeenCalled()
    expect(production.createPayment).not.toHaveBeenCalled()
    expect(deps.userCardRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ square_environment: "sandbox" })
    )
    expect(deps.subscriptionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ product_id: 122, square_environment: "sandbox" })
    )

    const created = (deps.eventBus.publish.mock.calls as any[])
      .map(([e]) => e)
      .find((e) => e.eventType === "SubscriptionCreated")
    expect(created.payload.environment).toBe("sandbox")
    expect(created.metadata.productData.cashoffers.user_config.role_v2).toBe("AGENT_EXP_PRO")
  })

  it("runs an ordinary purchase in production with the same role write", async () => {
    const { result, production, sandbox, deps } = await purchase(false)
    expect(result.success).toBe(true)
    expect(production.createPayment).toHaveBeenCalledTimes(1)
    expect(sandbox.createPayment).not.toHaveBeenCalled()
    expect(deps.subscriptionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ square_environment: "production" })
    )
    const created = (deps.eventBus.publish.mock.calls as any[])
      .map(([e]) => e)
      .find((e) => e.eventType === "SubscriptionCreated")
    expect(created.metadata.productData.cashoffers.user_config.role_v2).toBe("AGENT_EXP_PRO")
  })
})
