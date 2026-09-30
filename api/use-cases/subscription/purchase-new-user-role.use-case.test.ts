import { describe, it, expect, vi } from "vitest"

// The new-user flow resolves the product's white label through the services singleton, which would
// load config and the database. Nothing here needs either.
vi.mock("@api/lib/services", () => ({
  whitelabelResolverService: { resolveByCode: vi.fn(async () => ({ name: "ExpressOffers", whitelabel_id: 19 })) },
}))

const { PurchaseNewUserUseCase } = await import("./purchase-new-user.use-case")

/**
 * The role a brand new signup is created on.
 *
 * ExpressOffers Pro's legacy pair is `(AGENT, is_premium 0)`, which the main API reads as
 * AGENT_FREE. SubscriptionCreated carries no productData on the new-user path (the handler would
 * create the user twice), so unless the create itself names `role_v2`, a new Pro signup pays $49 and
 * sits on the free tier until the first renewal corrects it.
 */

/** ExpressOffers Pro as production holds it (product 122): note `is_premium: 0`. */
const PRO = {
  product_id: 122,
  product_name: "ExpressOffers Pro",
  price: 4900,
  whitelabel_code: "EXP",
  data: {
    duration: "monthly",
    renewal_cost: 4900,
    signup_fee: 0,
    cashoffers: {
      managed: true,
      user_config: { role: "AGENT", role_v2: "AGENT_EXP_PRO", is_premium: 0, is_team_plan: false },
    },
  },
}

const TEAM = {
  product_id: 7,
  product_name: "Small Team",
  price: 85000,
  whitelabel_code: null,
  data: {
    duration: "monthly",
    renewal_cost: 85000,
    signup_fee: 25000,
    cashoffers: {
      managed: true,
      user_config: { role: "TEAMOWNER", role_v2: "TEAMOWNER", is_premium: 1, is_team_plan: true, team_members: 6 },
    },
  },
}

/** A product not yet backfilled with `role_v2`: the tier is derived from the legacy pair. */
const LEGACY_PREMIUM = {
  product_id: 1,
  product_name: "Individual",
  price: 25000,
  whitelabel_code: null,
  data: {
    duration: "monthly",
    renewal_cost: 25000,
    cashoffers: { managed: true, user_config: { role: "AGENT", is_premium: 1 } },
  },
}

function deps(product: unknown) {
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
      createTeam: vi.fn(async () => ({ id: 77 })),
      updateUser: vi.fn(),
    },
    productRepository: { findById: vi.fn(async () => product) },
    promoCodeRepository: {},
    subscriptionRepository: {
      findByUserId: vi.fn(async () => []),
      findById: vi.fn(async () => null),
      create: vi.fn(async (data: any) => ({ subscription_id: 9, renewal_date: null, ...data })),
      update: vi.fn(),
    },
    userCardRepository: {
      create: vi.fn(async (data: any) => ({ id: 1, ...data })),
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
    emailHasAccount: vi.fn().mockResolvedValue(false),
  }
}

const input = (productId: number) => ({
  productId,
  email: "agent@exp.test",
  phone: "5555555555",
  cardToken: "cnon:card-nonce-ok",
  expMonth: 12,
  expYear: 2030,
  cardholderName: "Pat Agent",
  name: "Pat Agent",
})

describe("PurchaseNewUserUseCase: the role a new signup is created on", () => {
  it("creates an ExpressOffers Pro signup on AGENT_EXP_PRO, not the free tier its legacy pair implies", async () => {
    const d = deps(PRO)
    const result = await new PurchaseNewUserUseCase(d as never).execute(input(122) as never)

    expect(result.success).toBe(true)
    expect(d.userApiClient.createUser).toHaveBeenCalledTimes(1)
    expect(d.userApiClient.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: "AGENT", is_premium: 0, role_v2: "AGENT_EXP_PRO", whitelabel_id: 19 })
    )
  })

  it("leaves role_v2 off a team plan, which is created as SHELL and promoted once the team exists", async () => {
    const d = deps(TEAM)
    const result = await new PurchaseNewUserUseCase(d as never).execute(input(7) as never)

    expect(result.success).toBe(true)
    const created = d.userApiClient.createUser.mock.calls[0][0] as Record<string, unknown>
    expect(created.role).toBe("SHELL")
    expect(created.role_v2).toBeUndefined()
    expect(d.userApiClient.updateUser).toHaveBeenCalledWith(5001, { team_id: 77, role: "TEAMOWNER" })
  })

  it("derives role_v2 from the legacy pair for a product not yet backfilled", async () => {
    const d = deps(LEGACY_PREMIUM)
    const result = await new PurchaseNewUserUseCase(d as never).execute(input(1) as never)

    expect(result.success).toBe(true)
    expect(d.userApiClient.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: "AGENT", is_premium: 1, role_v2: "AGENT_PREMIUM" })
    )
  })
})
