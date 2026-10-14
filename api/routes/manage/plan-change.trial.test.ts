import { describe, it, expect, beforeEach, vi } from "vitest"
import type { CompiledQuery } from "kysely"

/**
 * D5 (Desk #1350, AC28): a plan change through POST /manage/purchase during a card-on-file trial
 * keeps the trial. The route runs for real on a capturing Kysely (every statement recorded, selects
 * answered from the fixtures below), and the test reads the `update Subscriptions` it sends.
 *
 * Before D5 the route wrote `data = ?` with the new product's data, which deleted `data.trial`.
 * Whether MySQL carries the trial is decided on the row it updates (unconverted trial: kept;
 * converted or no trial: the new data exactly as sent), proven on staging against a planted trial.
 */

const fixtures = vi.hoisted(() => ({
  user: {} as Record<string, unknown>,
  product: undefined as Record<string, unknown> | undefined,
  subscription: undefined as Record<string, unknown> | undefined,
}))

vi.mock("@api/lib/database", async () => {
  const { capturingKysely } = await import("@api/tests/helpers/capturing-kysely")
  const { db, queries } = capturingKysely((q: CompiledQuery) => {
    if (q.sql.includes("from `Products`")) return fixtures.product ? [fixtures.product] : []
    if (q.sql.includes("from `Subscriptions`")) return fixtures.subscription ? [fixtures.subscription] : []
    return []
  })
  return { db, queries }
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
  calculateProratedUseCase: { execute: vi.fn(async () => ({ success: true, data: { proratedAmount: 0 } })) },
  purchaseNewUserUseCase: { execute: vi.fn() },
  purchaseExistingUserUseCase: { execute: vi.fn() },
}))
vi.mock("@api/config/config.service", () => ({
  config: { jwtSecret: "test", nodeEnv: "test", api: { url: "http://api.test", key: "k", masterToken: "m" } },
}))
vi.mock("@api/use-cases/payment", () => ({ createPaymentUseCase: { execute: vi.fn() } }))

import { manageRoutes } from "./routes"
import * as database from "@api/lib/database"
import { eventBus } from "@api/lib/services"
import { capturingKysely, subscriptionUpdates, TRIAL_CARRIED_OVER } from "@api/tests/helpers/capturing-kysely"
import { evaluateDataWrite } from "@api/tests/helpers/evaluate-data-write"
import { readSubscriptionTrial } from "@api/domain/services/subscription-trial"

const queries = (database as unknown as { queries: CompiledQuery[] }).queries

const ENDS_AT = "2026-11-13T17:40:14.523Z"
const OLD_PRODUCT_DATA = {
  renewal_cost: 25000,
  duration: "monthly",
  cashoffers: {
    managed: true,
    user_config: { role: "AGENT", role_v2: "AGENT_PREMIUM", is_premium: 1, is_team_plan: false },
  },
}
const NEW_PRODUCT_DATA = {
  renewal_cost: 35000,
  duration: "monthly",
  cashoffers: {
    managed: true,
    user_config: { role: "AGENT", role_v2: "AGENT_ELITE", is_premium: 1, is_team_plan: false },
  },
}

/** A product's trial SETTING (Desk #1350), as every InstantOffers365 plan will carry it */
const TRIAL_SETTING = { enabled: true, duration_days: 30, require_card: true }

function subscriptionRow(data: Record<string, unknown>) {
  return {
    subscription_id: 280,
    user_id: 999846,
    product_id: 38,
    subscription_name: "Individual",
    amount: 25000,
    duration: "monthly",
    status: "active",
    renewal_date: new Date(ENDS_AT),
    data,
  }
}

async function changePlan() {
  return manageRoutes.request("/purchase", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product_id: 71, subscription_id: 280 }),
  })
}

/** The statement the route sent before D5, compiled on the same dialect, for comparison. */
function statementBeforeD5(set: Record<string, unknown>) {
  const { db, queries: q } = capturingKysely()
  return db
    .updateTable("Subscriptions")
    .set(set as any)
    .where("subscription_id", "=", 280)
    .execute()
    .then(() => q[0])
}

beforeEach(() => {
  vi.clearAllMocks()
  queries.length = 0
  fixtures.user = { user_id: 999846, email: "trial@test.cashoffers.com", role: "AGENT", whitelabel_id: null }
  fixtures.product = {
    product_id: 71,
    product_name: "Elite",
    product_type: "subscription",
    whitelabel_code: null,
    price: 35000,
    data: NEW_PRODUCT_DATA,
  }
})

describe("POST /manage/purchase during a trial (D5, AC28)", () => {
  it("writes the new product data and carries the stored trial block in the same statement", async () => {
    fixtures.subscription = subscriptionRow({ ...OLD_PRODUCT_DATA, trial: { ends_at: ENDS_AT, duration_days: 30 } })

    const res = await changePlan()
    expect(res.status).toBe(200)

    const updates = subscriptionUpdates(queries)
    expect(updates).toHaveLength(1)
    const [update] = updates
    expect(update.sql).toMatch(
      new RegExp(
        "^update `Subscriptions` set `product_id` = \\?, `subscription_name` = \\?, `amount` = \\?, `duration` = \\?, `data` = " +
          TRIAL_CARRIED_OVER.source +
          ", `updatedAt` = \\? where `subscription_id` = \\?$"
      )
    )
    // The new product's data is the document in every branch of the rewrite
    const doc = JSON.stringify(NEW_PRODUCT_DATA)
    expect(update.parameters.filter((p) => p === doc)).toHaveLength(3)
    expect(update.parameters.slice(0, 4)).toEqual([71, "Elite", 35000, "monthly"])
    expect(update.parameters[update.parameters.length - 1]).toBe(280)
    // A plan change does not move the first charge, so there is no ends_at rewrite and no renewal_date
    expect(update.sql).not.toContain("renewal_date")
    expect(update.sql).not.toContain("'$.trial.ends_at', ?")
  })

  it("a converted subscription's plan change sends the same columns and values as before D5, with the new data as the ELSE branch", async () => {
    fixtures.subscription = subscriptionRow({
      ...OLD_PRODUCT_DATA,
      trial: { ends_at: "2026-09-01T00:00:00.000Z", duration_days: 30 },
    })

    await changePlan()

    const [update] = subscriptionUpdates(queries)
    const doc = JSON.stringify(NEW_PRODUCT_DATA)
    const before = await statementBeforeD5({
      product_id: 71,
      subscription_name: "Elite",
      amount: 35000,
      duration: "monthly",
      data: doc,
      updatedAt: update.parameters[update.parameters.length - 2],
    })
    expect(before.sql).toBe(
      "update `Subscriptions` set `product_id` = ?, `subscription_name` = ?, `amount` = ?, `duration` = ?, `data` = ?, `updatedAt` = ? where `subscription_id` = ?"
    )
    // Same statement shape apart from the data expression, and the same values around it
    expect(update.sql.replace(TRIAL_CARRIED_OVER, "?")).toBe(before.sql)
    expect(update.parameters.filter((p) => p !== doc)).toEqual(before.parameters.filter((p) => p !== doc))
    // The ELSE branch (converted, or no trial) is the new document exactly as the route built it
    const elseAt = update.sql.indexOf("ELSE ?")
    const elseIndex = (update.sql.slice(0, elseAt + "ELSE ?".length).match(/\?/g) ?? []).length - 1
    expect(update.parameters[elseIndex]).toBe(doc)
  })

  it("a subscription with no trial gets the same statement: MySQL takes the ELSE branch for it", async () => {
    fixtures.subscription = subscriptionRow(OLD_PRODUCT_DATA)

    const res = await changePlan()
    expect(res.status).toBe(200)

    const [update] = subscriptionUpdates(queries)
    expect(update.sql).toMatch(TRIAL_CARRIED_OVER)
    expect(update.parameters.filter((p) => p === JSON.stringify(NEW_PRODUCT_DATA))).toHaveLength(3)
  })

  // PR #73 review, finding 1: every InstantOffers365 plan carries the trial SETTING in its data, so
  // a trial agent switching between two of them must keep the MARKER, not get the setting
  it("a trial agent moving to another trial-enabled product keeps the marker, with ends_at = renewal_date", async () => {
    const marker = { ends_at: ENDS_AT, duration_days: 30 }
    const stored = { ...OLD_PRODUCT_DATA, trial: marker }
    fixtures.subscription = subscriptionRow(stored)
    fixtures.product = { ...fixtures.product, data: { ...NEW_PRODUCT_DATA, trial: TRIAL_SETTING } }

    expect((await changePlan()).status).toBe(200)

    const [update] = subscriptionUpdates(queries)
    // The route writes the product's data without its setting
    expect(update.parameters).toContain(JSON.stringify(NEW_PRODUCT_DATA))
    expect(update.parameters.some((p) => typeof p === "string" && p.includes('"enabled"'))).toBe(false)
    // and MySQL keeps the stored marker
    const after = evaluateDataWrite(update, { data: JSON.stringify(stored) })!
    expect(after).toEqual({ ...NEW_PRODUCT_DATA, trial: marker })
    expect(readSubscriptionTrial(after)!.ends_at).toBe(new Date(ENDS_AT).toISOString())
    // The event still carries the product's data as configured
    const event = vi.mocked(eventBus.publish).mock.calls[0][0] as any
    expect((event.payload ?? event).toProductData).toEqual({ ...NEW_PRODUCT_DATA, trial: TRIAL_SETTING })
  })

  // PR #73 review, finding 2: a paying subscriber changing into a trial-enabled product gets no trial
  it("a paying subscriber moving into a trial-enabled product stores no trial key and no marker", async () => {
    fixtures.subscription = subscriptionRow(OLD_PRODUCT_DATA)
    fixtures.product = { ...fixtures.product, data: { ...NEW_PRODUCT_DATA, trial: TRIAL_SETTING } }

    expect((await changePlan()).status).toBe(200)

    const [update] = subscriptionUpdates(queries)
    const after = evaluateDataWrite(update, { data: JSON.stringify(OLD_PRODUCT_DATA) })!
    expect(after).toEqual(NEW_PRODUCT_DATA)
    expect(after).not.toHaveProperty("trial")
    expect(readSubscriptionTrial(after)).toBeNull()
  })

  it("still publishes SubscriptionUpgraded with the new product data", async () => {
    fixtures.subscription = subscriptionRow({ ...OLD_PRODUCT_DATA, trial: { ends_at: ENDS_AT, duration_days: 30 } })

    await changePlan()

    expect(eventBus.publish).toHaveBeenCalledTimes(1)
    const event = vi.mocked(eventBus.publish).mock.calls[0][0] as any
    expect(event.payload ?? event.data ?? event).toMatchObject({
      subscriptionId: 280,
      newProductId: 71,
      toProductData: NEW_PRODUCT_DATA,
    })
  })
})
