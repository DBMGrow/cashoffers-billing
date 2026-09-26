import { describe, it, expect, beforeEach, vi } from "vitest"

/**
 * Route tests for the direct product link (`?product=<id>`) on the manage routes, and the
 * white-label guard on the purchase routes.
 *
 * The database is a fake Kysely chain: every builder method records its arguments and returns the
 * chain, and `execute` / `executeTakeFirst` answer from the fixtures below by table. The fake reads
 * only the `where(column, "=", value)` calls it needs; callback `where`s (the white-label OR) are
 * recorded but not evaluated, which is why the category list is asserted on the category filter
 * and the recorded calls rather than on white-label filtering.
 */

type Call = [string, unknown[]]

const fixtures = vi.hoisted(() => ({
  user: {} as Record<string, unknown>,
  users: {} as Record<string, unknown> | undefined,
  whitelabels: [] as Array<{ whitelabel_id: number; code: string | null }>,
  products: [] as Array<Record<string, unknown>>,
  subscription: undefined as Record<string, unknown> | undefined,
  queries: [] as Array<{ table: string; calls: Call[] }>,
}))

function eqValue(calls: Call[], column: string): unknown {
  const hit = calls.find(([m, a]) => m === "where" && a[0] === column && a[1] === "=")
  return hit ? hit[1][2] : undefined
}

vi.mock("@api/lib/database", () => {
  const answer = (table: string, calls: Call[], mode: "first" | "many") => {
    let rows: unknown[] = []
    if (table === "Subscriptions") rows = fixtures.subscription ? [fixtures.subscription] : []
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
    fixtures.queries.push({ table, calls })
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
import { purchaseRoutes } from "../purchase/routes"
import { purchaseExistingUserUseCase } from "@api/use-cases/subscription"
import { userApiClient } from "@api/lib/services"

const EXP_WL = 7
const KW_WL = 3
const PLATFORM_WL = 1 // a white label with no code of its own

const expPro = {
  product_id: 70,
  product_name: "Express Offers Pro",
  product_type: "subscription",
  product_category: "premium_cashoffers",
  whitelabel_code: "EXP",
  price: 4900,
  data: { hidden: true, cashoffers: { managed: true, user_config: { role: "AGENT", role_v2: "AGENT_EXP_PRO" } } },
}
const kwPlan = { ...expPro, product_id: 80, product_name: "KW Plan", whitelabel_code: "KW", data: {} }
const sharedHu = {
  product_id: 5,
  product_name: "HomeUptick",
  product_type: "subscription",
  product_category: "homeuptick_only",
  whitelabel_code: null,
  price: 0,
  data: {},
}
const oneTimeExp = { ...expPro, product_id: 71, product_type: "one-time" }

/** The main API's answer for the signed-in user's role_v2 (the enrollment decision reads it). */
function withRoleV2(roleV2: string) {
  vi.mocked(userApiClient.getUser).mockResolvedValue({ id: 42, role: "AGENT", role_v2: roleV2 } as any)
}

function signInAs(whitelabelId: number | null, isPremium = 0) {
  fixtures.user = { user_id: 42, email: "guest@exp.test", role: "AGENT", whitelabel_id: whitelabelId }
  fixtures.users = { is_premium: isPremium, whitelabel_id: whitelabelId }
}

beforeEach(() => {
  vi.clearAllMocks()
  fixtures.whitelabels = [
    { whitelabel_id: EXP_WL, code: "EXP" },
    { whitelabel_id: KW_WL, code: "KW" },
    { whitelabel_id: PLATFORM_WL, code: null },
  ]
  fixtures.products = [expPro, kwPlan, sharedHu, oneTimeExp]
  fixtures.subscription = undefined
  fixtures.queries = []
  signInAs(EXP_WL)
})

describe("GET /manage/enrollment?product=<id>", () => {
  it("returns exactly the linked product for the user's own white label, hidden or not", async () => {
    const res = await manageRoutes.request("/enrollment?product=70")
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.success).toBe("success")
    expect(body.data.eligible).toBe(true)
    expect(body.data.product_category).toBe("premium_cashoffers")
    expect(body.data.products).toHaveLength(1)
    expect(body.data.products[0].product_id).toBe(70)
    expect(body.data.products[0].data.hidden).toBe(true)
  })

  it("skips the category logic entirely (no category query, ?category= ignored)", async () => {
    await manageRoutes.request("/enrollment?product=70&category=homeuptick_only")
    const productQueries = fixtures.queries.filter((q) => q.table === "Products")
    expect(productQueries).toHaveLength(1)
    expect(eqValue(productQueries[0].calls, "product_category")).toBeUndefined()
    expect(eqValue(productQueries[0].calls, "product_id")).toBe(70)
  })

  it("refuses another white label's product with 403 PRODUCT_NOT_AVAILABLE", async () => {
    const res = await manageRoutes.request("/enrollment?product=80")
    expect(res.status).toBe(403)
    const body: any = await res.json()
    expect(body).toMatchObject({ success: "error", code: "PRODUCT_NOT_AVAILABLE" })
    expect(body.data).toBeUndefined()
  })

  it("refuses a shared (NULL) product for a user whose white label has a code", async () => {
    const res = await manageRoutes.request("/enrollment?product=5")
    expect(res.status).toBe(403)
    expect(((await res.json()) as any).code).toBe("PRODUCT_NOT_AVAILABLE")
  })

  it("allows a shared (NULL) product for a user whose white label has no code", async () => {
    signInAs(PLATFORM_WL)
    const res = await manageRoutes.request("/enrollment?product=5")
    expect(res.status).toBe(200)
    expect(((await res.json()) as any).data.products.map((p: any) => p.product_id)).toEqual([5])
  })

  it("refuses a product that is not a subscription", async () => {
    const res = await manageRoutes.request("/enrollment?product=71")
    expect(res.status).toBe(403)
    expect(((await res.json()) as any).code).toBe("PRODUCT_NOT_AVAILABLE")
  })

  it("answers 404 PRODUCT_NOT_AVAILABLE for a product that does not exist", async () => {
    const res = await manageRoutes.request("/enrollment?product=9999")
    expect(res.status).toBe(404)
    expect((await res.json()) as any).toMatchObject({ success: "error", code: "PRODUCT_NOT_AVAILABLE" })
  })

  it("still answers 409 ALREADY_SUBSCRIBED first", async () => {
    fixtures.subscription = { subscription_id: 1 }
    const res = await manageRoutes.request("/enrollment?product=70")
    expect(res.status).toBe(409)
    expect(((await res.json()) as any).code).toBe("ALREADY_SUBSCRIBED")
  })

  it("rejects a malformed product id with 400 rather than ignoring it", async () => {
    const res = await manageRoutes.request("/enrollment?product=abc")
    expect(res.status).toBe(400)
  })
})

describe("GET /manage/enrollment without product", () => {
  it("picks homeuptick_only for a non-premium user and filters by the user's white label", async () => {
    const res = await manageRoutes.request("/enrollment")
    expect(res.status).toBe(200)
    expect((await res.json()) as any).toEqual({
      success: "success",
      data: {
        eligible: true,
        product_category: "homeuptick_only",
        reason: "User has no premium CashOffers account, eligible for HomeUptick standalone",
        intent: "homeuptick_only",
        products: [sharedHu],
      },
    })
    const productQuery = fixtures.queries.find((q) => q.table === "Products")!
    expect(eqValue(productQuery.calls, "product_category")).toBe("homeuptick_only")
    // the whitelabel_code = user's OR NULL filter is still applied
    expect(productQuery.calls.filter(([m, a]) => m === "where" && typeof a[0] === "function")).toHaveLength(1)
  })

  it("picks external_cashoffers for a premium user", async () => {
    signInAs(EXP_WL, 1)
    const body: any = await (await manageRoutes.request("/enrollment")).json()
    expect(body.data.product_category).toBe("external_cashoffers")
    expect(body.data.reason).toBe("User has active premium CashOffers account but no billing subscription")
  })

  it("honours ?category=", async () => {
    const body: any = await (await manageRoutes.request("/enrollment?category=premium_cashoffers")).json()
    expect(body.data.product_category).toBe("premium_cashoffers")
    expect(body.data.products.map((p: any) => p.product_id).sort()).toEqual([70, 71, 80])
  })
})

describe("GET /manage/products?product=<id>", () => {
  it("returns only the linked product, even when hidden", async () => {
    const res = await manageRoutes.request("/products?product=70")
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data.map((p: any) => p.product_id)).toEqual([70])
  })

  it("refuses another white label's product", async () => {
    const res = await manageRoutes.request("/products?product=80")
    expect(res.status).toBe(403)
    expect(((await res.json()) as any).code).toBe("PRODUCT_NOT_AVAILABLE")
  })

  it("answers 404 for a product that does not exist", async () => {
    const res = await manageRoutes.request("/products?product=9999")
    expect(res.status).toBe(404)
  })

  it("without product, still hides data.hidden products from the list", async () => {
    const res = await manageRoutes.request("/products")
    const ids = ((await res.json()) as any).data.map((p: any) => p.product_id)
    expect(ids).not.toContain(70)
    expect(ids).toContain(5)
  })
})

describe("POST /purchase/existing white-label guard", () => {
  const post = (product_id: number) =>
    purchaseRoutes.request("/existing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id }),
    })

  it("refuses another white label's product before the use case runs", async () => {
    const res = await post(80)
    expect(res.status).toBe(403)
    expect(((await res.json()) as any).code).toBe("PRODUCT_NOT_AVAILABLE")
    expect(purchaseExistingUserUseCase.execute).not.toHaveBeenCalled()
  })

  it("lets the user's own and shared products through to the use case", async () => {
    vi.mocked(purchaseExistingUserUseCase.execute).mockResolvedValue({
      success: false,
      error: "stop",
      code: "X",
    } as any)
    await post(70)
    await post(5)
    expect(purchaseExistingUserUseCase.execute).toHaveBeenCalledTimes(2)
  })
})

describe("POST /manage/purchase white-label guard", () => {
  it("refuses another white label's product", async () => {
    const res = await manageRoutes.request("/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: 80, subscription_id: 1 }),
    })
    expect(res.status).toBe(403)
    expect(((await res.json()) as any).code).toBe("PRODUCT_NOT_AVAILABLE")
  })
})

describe("GET /manage/enrollment intent", () => {
  it("is buy_product for a followed product link", async () => {
    const body: any = await (await manageRoutes.request("/enrollment?product=70")).json()
    expect(body.data.intent).toBe("buy_product")
  })

  it("is homeuptick_only for a non-premium, non-Guest user", async () => {
    withRoleV2("AGENT_FREE")
    const body: any = await (await manageRoutes.request("/enrollment")).json()
    expect(body.data).toMatchObject({ eligible: true, product_category: "homeuptick_only", intent: "homeuptick_only" })
  })

  it("is activate_homeuptick for a premium user (external_cashoffers)", async () => {
    signInAs(EXP_WL, 1)
    withRoleV2("AGENT_PREMIUM")
    const body: any = await (await manageRoutes.request("/enrollment")).json()
    expect(body.data).toMatchObject({ product_category: "external_cashoffers", intent: "activate_homeuptick" })
  })

  it("follows ?category=: premium_cashoffers is buy_product", async () => {
    const body: any = await (await manageRoutes.request("/enrollment?category=premium_cashoffers")).json()
    expect(body.data.intent).toBe("buy_product")
  })

  it("falls back to the legacy pair when the main API has no such user", async () => {
    vi.mocked(userApiClient.getUser).mockResolvedValue(null)
    const body: any = await (await manageRoutes.request("/enrollment")).json()
    expect(body.data.intent).toBe("homeuptick_only")
  })

  it("answers an error, not HomeUptick-only, when the role cannot be read", async () => {
    vi.mocked(userApiClient.getUser).mockRejectedValue(new Error("main API down"))
    const res = await manageRoutes.request("/enrollment")
    expect(res.status).toBe(400)
    expect(((await res.json()) as any).success).toBe("error")
  })
})

describe("GET /manage/enrollment for an Express Offers Guest", () => {
  const expHu = { ...sharedHu, product_id: 6, product_name: "eXp HomeUptick", whitelabel_code: "EXP" }

  beforeEach(() => {
    withRoleV2("AGENT_EXP_GUEST")
    fixtures.products = [expPro, kwPlan, sharedHu, expHu, oneTimeExp]
  })

  it("lands a Guest on plain /manage on enrollment for their Pro upgrade product", async () => {
    const res = await manageRoutes.request("/enrollment")
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.data).toMatchObject({ eligible: true, intent: "buy_product", product_category: "premium_cashoffers" })
    expect(body.data.products.map((p: any) => p.product_id)).toEqual([70])
    // The candidate query is the api-v2 resolver's: subscription products in the exact white label.
    const productQuery = fixtures.queries.find((q) => q.table === "Products")!
    expect(eqValue(productQuery.calls, "product_type")).toBe("subscription")
    expect(eqValue(productQuery.calls, "whitelabel_code")).toBe("EXP")
  })

  it("falls back to the dashboard (not eligible, no products) when there is no upgrade product", async () => {
    fixtures.products = [kwPlan, sharedHu, expHu]
    const body: any = await (await manageRoutes.request("/enrollment")).json()
    expect(body.data).toMatchObject({ eligible: false, intent: null, product_category: null, products: [] })
  })

  it("falls back to the dashboard when there are several upgrade products", async () => {
    fixtures.products = [expPro, { ...expPro, product_id: 72 }, sharedHu, expHu]
    const body: any = await (await manageRoutes.request("/enrollment")).json()
    expect(body.data).toMatchObject({ eligible: false, intent: null, products: [] })
  })

  it("does not take another white label's Pro product as the upgrade", async () => {
    fixtures.products = [
      { ...expPro, whitelabel_code: "KW" },
      { ...expPro, product_id: 73, whitelabel_code: null },
      sharedHu,
    ]
    const body: any = await (await manageRoutes.request("/enrollment")).json()
    expect(body.data).toMatchObject({ eligible: false, products: [] })
  })

  it("ignores ?category=homeuptick_only and still offers the upgrade", async () => {
    const body: any = await (await manageRoutes.request("/enrollment?category=homeuptick_only")).json()
    expect(body.data.intent).toBe("buy_product")
    expect(body.data.products.map((p: any) => p.product_id)).toEqual([70])
  })

  it("refuses a product link to a homeuptick_only product", async () => {
    const res = await manageRoutes.request("/enrollment?product=6")
    expect(res.status).toBe(403)
    expect(((await res.json()) as any).code).toBe("PRODUCT_NOT_AVAILABLE")
  })

  it("never lists a homeuptick_only product on /manage/products, nor resolves a link to one", async () => {
    const list: any = await (await manageRoutes.request("/products")).json()
    expect(list.data.map((p: any) => p.product_category)).not.toContain("homeuptick_only")
    const linked = await manageRoutes.request("/products?product=6")
    expect(linked.status).toBe(403)
  })

  it("still lists homeuptick_only products for a non-Guest", async () => {
    withRoleV2("AGENT_FREE")
    const list: any = await (await manageRoutes.request("/products")).json()
    expect(list.data.map((p: any) => p.product_id)).toContain(5)
  })
})
