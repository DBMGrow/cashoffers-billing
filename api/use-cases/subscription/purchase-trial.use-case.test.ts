import { describe, it, expect, vi } from "vitest"

// The new-user flow resolves the product's white label through the services singleton, which would
// load config and the database. Nothing here needs either.
vi.mock("@api/lib/services", () => ({
  whitelabelResolverService: {
    resolveByCode: vi.fn(async () => ({ name: "InstantOffers365", whitelabel_id: 10 })),
  },
}))

const { PurchaseNewUserUseCase } = await import("./purchase-new-user.use-case")

/**
 * Desk #1350: a product with `data.trial.enabled` saves the card, charges nothing, and sets the first
 * renewal N days out. The subscription stays `active` at the full amount, so the renewal cron takes
 * the first charge on day N. Plan: cashoffers-dashboard-mono
 * docs/plans/1350-instantoffers365-30-day-trial-plan.md, Phase 2 (card C3).
 */
const TRIAL = { enabled: true, duration_days: 30, require_card: true as const }

/** InstantOffers365 Individual (product 70): $250 a month, with the trial switched on. */
const INDIVIDUAL = {
  product_id: 70,
  product_name: "Individual",
  price: 25000,
  whitelabel_code: "instantoffers365",
  data: {
    duration: "monthly",
    renewal_cost: 25000,
    signup_fee: 0,
    trial: TRIAL,
    cashoffers: { managed: true, user_config: { role: "AGENT", is_premium: 1 } },
  },
}

/** An InstantOffers365 team plan: a flat team price, six seats, the same trial. */
const TEAM = {
  product_id: 71,
  product_name: "Team of 6",
  price: 60000,
  whitelabel_code: "instantoffers365",
  data: {
    duration: "monthly",
    renewal_cost: 60000,
    signup_fee: 0,
    trial: TRIAL,
    cashoffers: {
      managed: true,
      user_config: { role: "TEAMOWNER", is_premium: 1, is_team_plan: true, team_members: 6 },
    },
  },
}

const DAY = 86_400_000

function makeDeps(product: Record<string, any> = INDIVIDUAL, card: { card_id: string | null } | null = null) {
  // The subscription row as written, so findById (the team step's read-modify-write) reads it back
  let stored: Record<string, any> | null = null
  const deps = {
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
      createTeam: vi.fn(async () => ({ id: 77 })),
      updateUser: vi.fn(),
    },
    productRepository: { findById: vi.fn(async () => product) },
    promoCodeRepository: {
      reserve: vi.fn(),
      attachSubscription: vi.fn(),
      setUserId: vi.fn(),
      voidRedemption: vi.fn(),
    },
    subscriptionRepository: {
      findByUserId: vi.fn(async () => []),
      findById: vi.fn(async () => stored),
      create: vi.fn(async (data: any) => {
        stored = { subscription_id: 9, ...data }
        return stored
      }),
      update: vi.fn(async (_id: number, patch: any) => {
        stored = { ...stored, ...patch }
      }),
    },
    userCardRepository: {
      create: vi.fn(async (data: any) => ({ id: 1, ...data })),
      findByUserId: vi.fn(async () => []),
      findOne: vi.fn(async ({ card_id }: { card_id: string }) => ({
        id: 1,
        card_id: card ? card.card_id : card_id,
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
      create: vi.fn(async () => ({ request_id: 101, request_uuid: "uuid-101" })),
      update: vi.fn(),
      updateStatus: vi.fn(),
      markAsFailed: vi.fn(),
      markAsCompleted: vi.fn(),
    },
    homeUptickSubscriptionRepository: { create: vi.fn(), findByUserId: vi.fn(async () => null) },
    eventBus: { publish: vi.fn() },
    adminAlertEmail: "admin@test",
    emailHasAccount: vi.fn().mockResolvedValue(false),
  }
  return { deps, stored: () => stored }
}

const input = (productId: number, coupon: string | null = null) => ({
  productId,
  email: "agent@io365.test",
  phone: "5555555555",
  cardToken: "cnon:card-nonce-ok",
  expMonth: 12,
  expYear: 2030,
  cardholderName: "Pat Agent",
  name: "Pat Agent",
  coupon,
})

const daysFromNow = (date: Date) => (date.getTime() - Date.now()) / DAY

describe("PurchaseNewUserUseCase on a trial product", () => {
  // AC1
  it("defers the first charge on a trial product", async () => {
    const { deps } = makeDeps()
    const result = await new PurchaseNewUserUseCase(deps as never).execute(input(70) as never)

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.amount).toBe(0)

    // The card is created and saved; nothing is charged
    expect(deps.paymentProvider.createCard).toHaveBeenCalledTimes(1)
    expect(deps.userCardRepository.create).toHaveBeenCalledTimes(1)
    expect(deps.paymentProvider.createPayment).not.toHaveBeenCalled()

    // Active, at the full price, renewing in 30 days, with the trial marker equal to renewal_date
    const created = (deps.subscriptionRepository.create.mock.calls[0] as any)[0]
    expect(created.status).toBe("active")
    expect(created.amount).toBe(25000)
    expect(Math.abs(daysFromNow(created.renewal_date) - 30)).toBeLessThan(1 / 24 + 0.001)
    const data = JSON.parse(created.data)
    expect(data.trial).toEqual({ ends_at: created.renewal_date.toISOString(), duration_days: 30 })

    // No payment transaction: only the $0 subscription record
    const types = deps.transactionRepository.create.mock.calls.map(([row]: any[]) => row.type)
    expect(types).toEqual(["subscription"])
    expect((deps.transactionRepository.create.mock.calls[0] as any)[0].amount).toBe(0)

    // No PaymentProcessed (no commission until the first real charge)
    const events = deps.eventBus.publish.mock.calls.map(([event]: any[]) => event.eventType)
    expect(events).toContain("SubscriptionCreated")
    expect(events).not.toContain("PaymentProcessed")

    expect(deps.logger.info).toHaveBeenCalledWith(
      "Trial purchase: card saved, first charge deferred",
      expect.objectContaining({ trialDays: 30, firstChargeDue: expect.any(String) })
    )
  })

  // AC3
  it("a trial without a saved card fails", async () => {
    const { deps } = makeDeps(INDIVIDUAL, { card_id: null })
    const result = await new PurchaseNewUserUseCase(deps as never).execute(input(70) as never)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.code).toBe("TRIAL_CARD_REQUIRED")
    expect(deps.purchaseRequestRepository.markAsFailed).toHaveBeenCalledWith(
      101,
      "Trial requires a card",
      "TRIAL_CARD_REQUIRED"
    )
    expect(deps.subscriptionRepository.create).not.toHaveBeenCalled()
    expect(deps.paymentProvider.createPayment).not.toHaveBeenCalled()
  })

  // AC4 (plan Q7: ignore, do not refuse)
  it("ignores a coupon on a trial product", async () => {
    const { deps } = makeDeps()
    const result = await new PurchaseNewUserUseCase(deps as never).execute(input(70, "EXPCON") as never)

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.amount).toBe(0)
    expect(deps.promoCodeRepository.reserve).not.toHaveBeenCalled()
    expect(deps.paymentProvider.createPayment).not.toHaveBeenCalled()
    expect(deps.logger.warn).toHaveBeenCalledWith(
      "Coupon ignored on a trial product",
      expect.objectContaining({ purchaseRequestId: 101, coupon: "EXPCON" })
    )
  })

  // AC18
  it("a team plan trial creates the team and defers the charge", async () => {
    const { deps, stored } = makeDeps(TEAM)
    const result = await new PurchaseNewUserUseCase(deps as never).execute(input(71) as never)

    expect(result.success).toBe(true)
    expect(deps.paymentProvider.createPayment).not.toHaveBeenCalled()

    // The team is created with its seats exactly as for a paid team signup
    expect(deps.userApiClient.createTeam).toHaveBeenCalledWith(
      expect.objectContaining({ owner_id: 5001, max_users: 6 })
    )
    expect(deps.userApiClient.updateUser).toHaveBeenCalledWith(5001, { team_id: 77, role: "TEAMOWNER" })

    const created = (deps.subscriptionRepository.create.mock.calls[0] as any)[0]
    expect(created.amount).toBe(60000)
    expect(created.status).toBe("active")
    expect(Math.abs(daysFromNow(created.renewal_date) - 30)).toBeLessThan(1 / 24 + 0.001)

    // The team step's read-modify-write of Subscriptions.data keeps the trial marker
    const finalData = JSON.parse(stored()!.data)
    expect(finalData.team_id).toBe(77)
    expect(finalData.trial).toEqual({ ends_at: created.renewal_date.toISOString(), duration_days: 30 })
  })

  it("a disabled trial charges at signup as today", async () => {
    const { deps } = makeDeps({ ...INDIVIDUAL, data: { ...INDIVIDUAL.data, trial: { ...TRIAL, enabled: false } } })
    const result = await new PurchaseNewUserUseCase(deps as never).execute(input(70) as never)

    expect(result.success).toBe(true)
    expect(deps.paymentProvider.createPayment).toHaveBeenCalledTimes(1)
    expect((deps.paymentProvider.createPayment.mock.calls[0] as any)[0].amountMoney.amount).toBe(BigInt(25000))
    const created = (deps.subscriptionRepository.create.mock.calls[0] as any)[0]
    expect(JSON.parse(created.data).trial).toBeUndefined()
  })
})
