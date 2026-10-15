import { describe, it, expect, beforeEach, vi } from "vitest"

/**
 * Route tests for the returning-subscriber branch of `GET /manage/enrollment` (Desk #1758).
 *
 * A lapsed CashOffers agent signs in to the account site with a card already on file and no
 * running subscription. Before this branch existed the route classified them as a HomeUptick
 * standalone prospect, so the account site offered them a HomeUptick plan, or nothing at all on a
 * white label that sells none, and the only action left to them was updating their card.
 *
 * The database is a fake Kysely chain, as in product-link.routes.test.ts: every builder method
 * records its arguments and returns the chain, and `execute` / `executeTakeFirst` answer from the
 * fixtures by table. The two Subscriptions queries on this path are told apart by the join: the
 * eligibility check selects the user's running subscriptions, while the prior-plans query joins
 * Products for the categories of the plans they used to hold.
 */

type Call = [string, unknown[]]

const fixtures = vi.hoisted(() => ({
  user: {} as Record<string, unknown>,
  users: {} as Record<string, unknown> | undefined,
  whitelabels: [] as Array<{ whitelabel_id: number; code: string | null }>,
  products: [] as Array<Record<string, unknown>>,
  /** The user's running subscription, if any: what the 409 eligibility check reads. */
  subscription: undefined as Record<string, unknown> | undefined,
  /** The plans the user held before: their category and subscription status. */
  priorPlans: [] as Array<{ product_category: string | null; status: string | null }>,
}))

function eqValue(calls: Call[], column: string): unknown {
  const hit = calls.find(([m, a]) => m === "where" && a[0] === column && a[1] === "=")
  return hit ? hit[1][2] : undefined
}

vi.mock("@api/lib/database", () => {
  const answer = (table: string, calls: Call[], mode: "first" | "many") => {
    let rows: unknown[] = []
    if (table === "Subscriptions") {
      const joinsProducts = calls.some(([m]) => m === "innerJoin")
      rows = joinsProducts ? fixtures.priorPlans : fixtures.subscription ? [fixtures.subscription] : []
    }
    if (table === "Users") rows = fixtures.users ? [fixtures.users] : []
    if (table === "Whitelabels") {
      const id = eqValue(calls, "whitelabel_id")
      rows = fixtures.whitelabels.filter((w) => w.whitelabel_id === id)
    }
    if (table === "Products") {
      const id = eqValue(calls, "product_id")
      const category = eqValue(calls, "product_category")
      rows = fixtures.products.filter(
        (p) => (id === undefined || p.product_id === id) && (category === undefined || p.product_category === category)
      )
    }
    return mode === "first" ? rows[0] : rows
  }
  const builder = (table: string) => {
    const calls: Call[] = []
    const chain: any = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") return undefined
          if (prop === "execute") return async () => answer(table, calls, "many")
          if (prop === "executeTakeFirst") return async () => answer(table, calls, "first")
          return (...args: unknown[]) => {
            calls.push([prop, args])
            if (prop === "$if" && args[0]) (args[1] as (q: unknown) => unknown)(chain)
            return chain
          }
        },
      }
    )
    return chain
  }
  return { db: { selectFrom: (table: string) => builder(table) } }
})

vi.mock("@api/lib/middleware/authMiddleware", () => ({
  authMiddleware: () => async (c: any, next: () => Promise<void>) => {
    c.set("user", fixtures.user)
    await next()
  },
}))

vi.mock("@api/lib/services", () => ({ eventBus: { publish: vi.fn() }, userApiClient: { getUser: vi.fn() } }))
vi.mock("@api/lib/repositories", () => ({
  productRepository: { findById: vi.fn() },
  userCardRepository: { findByUserId: vi.fn(async () => []) },
}))
vi.mock("@api/use-cases/subscription", () => ({
  calculateProratedUseCase: { execute: vi.fn() },
  purchaseNewUserUseCase: { execute: vi.fn() },
  purchaseExistingUserUseCase: { execute: vi.fn() },
}))
vi.mock("@api/config/config.service", () => ({
  config: { jwtSecret: "test", nodeEnv: "test", api: { url: "http://api.test", key: "k", masterToken: "m" } },
}))
vi.mock("@api/use-cases/payment", () => ({ createPaymentUseCase: { execute: vi.fn() } }))

import { manageRoutes } from "./routes"
import { userApiClient } from "@api/lib/services"

const WL = 7

const agentPlan = {
  product_id: 70,
  product_name: "InstantOffers Pro",
  product_type: "subscription",
  product_category: "premium_cashoffers",
  whitelabel_code: "IO",
  price: 4900,
  data: { cashoffers: { managed: true, user_config: { role: "AGENT", role_v2: "AGENT_PREMIUM" } } },
}
const huPlan = {
  product_id: 5,
  product_name: "HomeUptick",
  product_type: "subscription",
  product_category: "homeuptick_only",
  whitelabel_code: null,
  price: 0,
  data: {},
}

/** The main API's answer for the signed-in user's role_v2 (the enrollment decision reads it). */
function withRoleV2(roleV2: string) {
  vi.mocked(userApiClient.getUser).mockResolvedValue({ id: 42, role: "SHELL", role_v2: roleV2 } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  fixtures.whitelabels = [{ whitelabel_id: WL, code: "IO" }]
  fixtures.products = [agentPlan, huPlan]
  fixtures.subscription = undefined
  fixtures.priorPlans = []
  fixtures.user = { user_id: 42, email: "agent@io.test", role: "SHELL", whitelabel_id: WL }
  fixtures.users = { is_premium: 0, whitelabel_id: WL }
  withRoleV2("SHELL")
})

describe("GET /manage/enrollment for a returning subscriber (Desk #1758)", () => {
  it("offers the CashOffers plan again to a shelled agent whose subscription has ended", async () => {
    fixtures.priorPlans = [{ product_category: "premium_cashoffers", status: "cancelled" }]

    const res = await manageRoutes.request("/enrollment")
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data.eligible).toBe(true)
    expect(body.data.product_category).toBe("premium_cashoffers")
    expect(body.data.intent).toBe("buy_product")
    expect(body.data.products.map((p: any) => p.product_id)).toEqual([70])
  })

  it("sends an agent whose plan is suspended to the dashboard, never to a second plan", async () => {
    fixtures.priorPlans = [
      { product_category: "premium_cashoffers", status: "cancelled" },
      { product_category: "premium_cashoffers", status: "suspended" },
    ]

    const res = await manageRoutes.request("/enrollment")
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data.eligible).toBe(false)
    expect(body.data.intent).toBeNull()
    expect(body.data.products).toEqual([])
  })

  it("still offers HomeUptick standalone to a user who never held a CashOffers plan", async () => {
    fixtures.priorPlans = []

    const res = await manageRoutes.request("/enrollment")
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data.product_category).toBe("homeuptick_only")
    expect(body.data.intent).toBe("homeuptick_only")
    expect(body.data.products.map((p: any) => p.product_id)).toEqual([5])
  })

  it("still offers HomeUptick standalone when only a HomeUptick plan has lapsed", async () => {
    fixtures.priorPlans = [{ product_category: "homeuptick_only", status: "cancelled" }]

    const res = await manageRoutes.request("/enrollment")
    const body: any = await res.json()
    expect(body.data.product_category).toBe("homeuptick_only")
  })

  it("leaves a user who pays for CashOffers elsewhere on external_cashoffers", async () => {
    fixtures.users = { is_premium: 1, whitelabel_id: WL }
    fixtures.priorPlans = [{ product_category: "premium_cashoffers", status: "cancelled" }]

    const res = await manageRoutes.request("/enrollment")
    const body: any = await res.json()
    expect(body.data.product_category).toBe("external_cashoffers")
    expect(body.data.intent).toBe("activate_homeuptick")
  })

  it("leaves an admin-directed category override in charge", async () => {
    fixtures.priorPlans = [{ product_category: "premium_cashoffers", status: "cancelled" }]

    const res = await manageRoutes.request("/enrollment?category=homeuptick_only")
    const body: any = await res.json()
    expect(body.data.product_category).toBe("homeuptick_only")
  })

  it("still refuses a user who already has a running subscription", async () => {
    fixtures.subscription = { subscription_id: 9 }
    fixtures.priorPlans = [{ product_category: "premium_cashoffers", status: "cancelled" }]

    const res = await manageRoutes.request("/enrollment")
    expect(res.status).toBe(409)
  })
})
