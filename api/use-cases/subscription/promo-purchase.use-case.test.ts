import { describe, it, expect, vi } from "vitest"
import type { ReservePromoInput } from "@api/infrastructure/database/repositories/promo-code.repository"
import type { PromoDefinition } from "@api/domain/services/promo-evaluation"

// The new-user flow resolves the product's white label through the services singleton, which would
// load config and the database. Nothing here needs either.
vi.mock("@api/lib/services", () => ({
  whitelabelResolverService: { resolveByCode: vi.fn(async () => ({ name: "ExpressOffers", whitelabel_id: 9 })) },
}))

const { PurchaseNewUserUseCase } = await import("./purchase-new-user.use-case")
const { PurchaseExistingUserUseCase } = await import("./purchase-existing-user.use-case")

const EXPCON: PromoDefinition = {
  promo_id: 1,
  code: "EXPCON",
  whitelabel_code: "EXP",
  product_ids: null,
  product_roles: ["AGENT_EXP_PRO"],
  discount_type: "free_periods",
  discount_value: 1,
  applies_to: "first_period",
  duration_periods: 1,
  max_redemptions: null,
  max_per_user: 1,
  starts_at: null,
  ends_at: new Date("2099-01-01T00:00:00Z"),
  active: true,
  new_users_only: true,
  campaign: "eXpCon 2026",
}

/** ExpressOffers Pro. `signup_fee: 0` so a new signup's first charge is exactly the first month. */
const PRO = {
  product_id: 70,
  product_name: "ExpressOffers Pro",
  price: 4900,
  whitelabel_code: "EXP",
  data: {
    duration: "monthly",
    renewal_cost: 4900,
    signup_fee: 0,
    cashoffers: { managed: true, user_config: { role: "AGENT", role_v2: "AGENT_EXP_PRO", is_premium: 1 } },
  },
}

/**
 * In-memory PromoCodeRepository with the same contract as the real one: `reserve` counts
 * non-voided redemptions (this purchase request excluded), lets `decide` rule, and holds at most one
 * row per purchase_request_id (the UNIQUE key).
 */
function fakePromoRepo(promos: PromoDefinition[] = [EXPCON]) {
  const rows: Array<Record<string, any>> = []
  const repo = {
    rows,
    reserve: vi.fn(async (input: ReservePromoInput) => {
      const promo = promos.find((p) => p.code === input.code.toUpperCase()) ?? null
      if (!promo) return { evaluation: input.decide(null, { total: 0, forUser: 0 }), redemptionId: null }
      const live = rows.filter(
        (r) =>
          r.promo_id === promo.promo_id && r.status !== "voided" && r.purchase_request_id !== input.purchaseRequestId
      )
      const forUser = live.filter(
        (r) => r.email === input.email.toLowerCase() || (input.userId != null && r.user_id === input.userId)
      )
      const evaluation = input.decide(promo, { total: live.length, forUser: forUser.length })
      if (!evaluation.ok) return { evaluation, redemptionId: null }
      const existing = rows.find((r) => r.purchase_request_id === input.purchaseRequestId)
      const values = {
        promo_id: promo.promo_id,
        code: promo.code,
        email: input.email.toLowerCase(),
        user_id: input.userId,
        purchase_request_id: input.purchaseRequestId,
        original_amount: evaluation.originalAmount,
        discount_amount: evaluation.discountAmount,
        charged_amount: evaluation.chargedAmount,
        subscription_id: null,
        status: "applied",
      }
      if (existing) {
        Object.assign(existing, values)
        return { evaluation, redemptionId: existing.redemption_id }
      }
      const row = { redemption_id: rows.length + 1, ...values }
      rows.push(row)
      return { evaluation, redemptionId: row.redemption_id }
    }),
    attachSubscription: vi.fn(async (id: number, subscriptionId: number, userId: number | null) => {
      const row = rows.find((r) => r.redemption_id === id)!
      row.subscription_id = subscriptionId
      if (userId != null) row.user_id = userId
    }),
    setUserId: vi.fn(async (id: number, userId: number) => {
      rows.find((r) => r.redemption_id === id)!.user_id = userId
    }),
    voidRedemption: vi.fn(async (id: number) => {
      rows.find((r) => r.redemption_id === id)!.status = "voided"
    }),
  }
  return repo
}

function baseDeps(promoCodeRepository: ReturnType<typeof fakePromoRepo>, product = PRO) {
  let requestId = 100
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    paymentProvider: {
      createCard: vi.fn(async () => ({
        id: "ccof:new",
        customerId: "cust_1",
        environment: "sandbox",
        cardBrand: "VISA",
        last4: "1111",
      })),
      createPayment: vi.fn(async () => ({ id: "pay_1", status: "COMPLETED", environment: "sandbox" as const })),
    },
    emailService: { sendEmail: vi.fn() },
    userApiClient: {
      createUser: vi.fn(async () => ({ id: 5001 })),
      createTeam: vi.fn(),
      updateUser: vi.fn(),
    },
    productRepository: { findById: vi.fn(async () => product) },
    promoCodeRepository,
    subscriptionRepository: {
      findByUserId: vi.fn(async () => [] as Array<{ amount: number; status: string }>),
      findById: vi.fn(async () => null),
      create: vi.fn(async (data: any) => ({ subscription_id: 9, renewal_date: null, ...data })),
      update: vi.fn(),
    },
    userCardRepository: {
      create: vi.fn(async (data: any) => ({ id: 1, ...data })),
      findByUserId: vi.fn(async () => [{ card_id: "ccof:onfile" }]),
      findOne: vi.fn(async ({ card_id }: { card_id: string }) => ({
        id: 1,
        card_id,
        square_customer_id: "cust_1",
        last_4: "1111",
      })),
      findAll: vi.fn(async () => [{ id: 1 }]),
      update: vi.fn(),
    },
    transactionRepository: {
      create: vi.fn(async () => ({ transaction_id: 3 })),
      update: vi.fn(),
      findAll: vi.fn(async () => []),
    },
    purchaseRequestRepository: {
      create: vi.fn(async () => ({ request_id: ++requestId, request_uuid: `uuid-${requestId}` })),
      update: vi.fn(),
      updateStatus: vi.fn(),
      markAsFailed: vi.fn(),
      markAsCompleted: vi.fn(),
    },
    homeUptickSubscriptionRepository: { create: vi.fn(), findByUserId: vi.fn(async () => null) },
    eventBus: { publish: vi.fn() },
    adminAlertEmail: "admin@test",
    // Present once feat/express-offers-upgrade-link merges (the existing-email guard); harmless before.
    emailHasAccount: vi.fn().mockResolvedValue(false),
  }
}

const newUserInput = (coupon: string | null) => ({
  productId: 70,
  email: "Agent@eXp.test",
  phone: "5555555555",
  cardToken: "cnon:card-nonce-ok",
  expMonth: 12,
  expYear: 2030,
  cardholderName: "Pat Agent",
  name: "Pat Agent",
  coupon,
})

function publishedLineItems(deps: ReturnType<typeof baseDeps>) {
  const created = deps.eventBus.publish.mock.calls
    .map(([event]: any[]) => event)
    .find((event: any) => event.eventType === "SubscriptionCreated")
  return created?.payload
}

describe("PurchaseNewUserUseCase with a promo code", () => {
  it("first month free: saves the card, charges nothing, keeps Subscriptions.amount at list price", async () => {
    const promoRepo = fakePromoRepo()
    const deps = baseDeps(promoRepo)
    const result = await new PurchaseNewUserUseCase(deps as never).execute(newUserInput("expcon") as never)

    expect(result.success).toBe(true)
    // The card is created and saved even though today's charge is $0 (the first renewal needs it)
    expect(deps.paymentProvider.createCard).toHaveBeenCalledTimes(1)
    expect(deps.userCardRepository.create).toHaveBeenCalledTimes(1)
    expect(deps.paymentProvider.createPayment).not.toHaveBeenCalled()
    // The subscription renews at the list price
    expect(deps.subscriptionRepository.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 4900 }))
    if (result.success) expect(result.data.amount).toBe(0)

    // One redemption, linked to the subscription and the provisioned user
    expect(promoRepo.reserve).toHaveBeenCalledTimes(1)
    expect(promoRepo.rows).toHaveLength(1)
    expect(promoRepo.rows[0]).toMatchObject({
      code: "EXPCON",
      email: "agent@exp.test",
      subscription_id: 9,
      user_id: 5001,
      original_amount: 4900,
      discount_amount: 4900,
      charged_amount: 0,
      status: "applied",
    })

    // The welcome email shows the discount line and a $0 charge, not "$49 charged"
    const payload = publishedLineItems(deps)
    expect(payload.amount).toBe(4900)
    expect(payload.initialChargeAmount).toBe(0)
    expect(payload.lineItems).toContainEqual({ description: "Promo EXPCON: First month free", amount: -4900 })
  })

  it("refuses an unknown code before any card or charge, with a user-facing code", async () => {
    const promoRepo = fakePromoRepo()
    const deps = baseDeps(promoRepo)
    const result = await new PurchaseNewUserUseCase(deps as never).execute(newUserInput("NOPE") as never)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe("PROMO_CODE_INVALID")
      expect(result.error).toBe("That promo code isn't valid.")
    }
    expect(deps.paymentProvider.createCard).not.toHaveBeenCalled()
    expect(deps.paymentProvider.createPayment).not.toHaveBeenCalled()
    expect(deps.subscriptionRepository.create).not.toHaveBeenCalled()
    expect(deps.purchaseRequestRepository.markAsFailed).toHaveBeenCalledWith(
      101,
      expect.any(String),
      "PROMO_CODE_INVALID"
    )
    // User-facing: no developer alert email
    expect(deps.emailService.sendEmail).not.toHaveBeenCalled()
  })

  it("refuses an expired code instead of charging full price", async () => {
    const promoRepo = fakePromoRepo([{ ...EXPCON, ends_at: new Date("2020-01-01T00:00:00Z") }])
    const deps = baseDeps(promoRepo)
    const result = await new PurchaseNewUserUseCase(deps as never).execute(newUserInput("EXPCON") as never)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.code).toBe("PROMO_CODE_INVALID")
    expect(deps.paymentProvider.createPayment).not.toHaveBeenCalled()
  })

  it("charges the discounted amount when the promo leaves something to pay", async () => {
    const promoRepo = fakePromoRepo()
    // The real Pro row has no data.signup_fee, so a new signup pays price (4900) as a signup fee too
    const product = { ...PRO, data: { ...PRO.data, signup_fee: undefined } }
    const deps = baseDeps(promoRepo, product as never)
    const result = await new PurchaseNewUserUseCase(deps as never).execute(newUserInput("EXPCON") as never)

    expect(result.success).toBe(true)
    expect(deps.paymentProvider.createPayment).toHaveBeenCalledTimes(1)
    const [paymentRequest] = deps.paymentProvider.createPayment.mock.calls[0] as any[]
    expect(paymentRequest.amountMoney.amount).toBe(BigInt(4900))
    expect(deps.subscriptionRepository.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 4900 }))
  })

  it("voids the reservation when the card fails, so a retry can redeem", async () => {
    const promoRepo = fakePromoRepo()
    const deps = baseDeps(promoRepo)
    deps.paymentProvider.createCard.mockRejectedValueOnce(new Error("card declined"))
    const first = await new PurchaseNewUserUseCase(deps as never).execute(newUserInput("EXPCON") as never)
    expect(first.success).toBe(false)
    expect(promoRepo.rows[0].status).toBe("voided")

    const retry = await new PurchaseNewUserUseCase(deps as never).execute(newUserInput("EXPCON") as never)
    expect(retry.success).toBe(true)
    expect(promoRepo.rows.filter((r) => r.status === "applied")).toHaveLength(1)
  })

  it("refuses a second redemption by the same email", async () => {
    const promoRepo = fakePromoRepo()
    const deps = baseDeps(promoRepo)
    const first = await new PurchaseNewUserUseCase(deps as never).execute(newUserInput("EXPCON") as never)
    const second = await new PurchaseNewUserUseCase(deps as never).execute(newUserInput("EXPCON") as never)
    expect(first.success).toBe(true)
    expect(second.success).toBe(false)
    if (!second.success) expect(second.code).toBe("PROMO_CODE_INVALID")
    expect(promoRepo.rows).toHaveLength(1)
  })

  it("leaves a purchase without a coupon untouched", async () => {
    const promoRepo = fakePromoRepo()
    const deps = baseDeps(promoRepo)
    const result = await new PurchaseNewUserUseCase(deps as never).execute(newUserInput(null) as never)
    expect(result.success).toBe(true)
    expect(promoRepo.reserve).not.toHaveBeenCalled()
    expect(deps.paymentProvider.createPayment).toHaveBeenCalledTimes(1)
  })
})

describe("PurchaseExistingUserUseCase with a promo code (ExpressOffers Guest upgrading)", () => {
  const input = (coupon: string | null) => ({ userId: 999749, productId: 70, email: "guest@exp.test", coupon })

  it("first month free: uses the card on file, charges nothing, subscription at list price", async () => {
    const promoRepo = fakePromoRepo()
    const deps = baseDeps(promoRepo)
    // A Guest's $0 subscription does not make them a returning paid customer
    deps.subscriptionRepository.findByUserId.mockResolvedValue([{ amount: 0, status: "active" }])
    const result = await new PurchaseExistingUserUseCase(deps as never).execute(input("EXPCON") as never)

    expect(result.success).toBe(true)
    expect(deps.userCardRepository.findOne).toHaveBeenCalled()
    expect(deps.paymentProvider.createPayment).not.toHaveBeenCalled()
    expect(deps.subscriptionRepository.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 4900 }))
    expect(promoRepo.rows[0]).toMatchObject({ user_id: 999749, subscription_id: 9, charged_amount: 0 })
    expect(publishedLineItems(deps).lineItems).toContainEqual({
      description: "Promo EXPCON: First month free",
      amount: -4900,
    })
  })

  it("refuses a new-users-only code for someone who already paid, before any charge", async () => {
    const promoRepo = fakePromoRepo()
    const deps = baseDeps(promoRepo)
    deps.subscriptionRepository.findByUserId.mockResolvedValue([{ amount: 4900, status: "cancelled" }])
    const result = await new PurchaseExistingUserUseCase(deps as never).execute(input("EXPCON") as never)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe("PROMO_CODE_INVALID")
      expect(result.error).toBe("That promo code is for new members only.")
    }
    expect(deps.paymentProvider.createPayment).not.toHaveBeenCalled()
    expect(deps.subscriptionRepository.create).not.toHaveBeenCalled()
  })

  it("charges a percent-off code's remainder", async () => {
    const promoRepo = fakePromoRepo([{ ...EXPCON, code: "HALF", discount_type: "percent", discount_value: 50 }])
    const deps = baseDeps(promoRepo)
    const result = await new PurchaseExistingUserUseCase(deps as never).execute(input("half") as never)

    expect(result.success).toBe(true)
    const [paymentRequest] = deps.paymentProvider.createPayment.mock.calls[0] as any[]
    expect(paymentRequest.amountMoney.amount).toBe(BigInt(2450))
    expect(deps.subscriptionRepository.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 4900 }))
  })
})
