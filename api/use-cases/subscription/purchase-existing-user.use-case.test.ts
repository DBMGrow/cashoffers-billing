import { describe, it, expect, vi } from "vitest"
import { PurchaseExistingUserUseCase } from "./purchase-existing-user.use-case"

/**
 * CO-I271 F-S4-e (AC21). An existing ExpressOffers Guest enrolled in product 70 (price 4900,
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
  it("charges ExpressOffers Pro its monthly price once (4900, not 9800)", async () => {
    const { result, createPayment } = await run({
      product_id: 70,
      product_name: "ExpressOffers Pro",
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
