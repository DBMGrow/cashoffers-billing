import { describe, it, expect } from "vitest"
import { planProduct, applyPlan, configSites } from "./product-role-backfill"

const nested = (config: Record<string, unknown>) => ({ cashoffers: { managed: true, user_config: config } })
const root = (config: Record<string, unknown>) => ({ user_config: config })

describe("planProduct", () => {
  it("derives the tier from the legacy pair", () => {
    expect(planProduct(nested({ role: "AGENT", is_premium: 1 }))).toEqual({
      kind: "stamped",
      changes: [{ path: "cashoffers.user_config", from: "AGENT", premium: 1, to: "AGENT_PREMIUM" }],
    })
    expect(planProduct(nested({ role: "AGENT", is_premium: 0 }))).toMatchObject({
      changes: [{ to: "AGENT_FREE" }],
    })
    expect(planProduct(nested({ role: "TEAMOWNER", is_premium: 1 }))).toMatchObject({ changes: [{ to: "TEAMOWNER" }] })
    expect(planProduct(nested({ role: "HOMEUPTICK", is_premium: 0 }))).toMatchObject({
      changes: [{ to: "HOMEUPTICK" }],
    })
  })

  it("stamps both config shapes when a product carries both", () => {
    const outcome = planProduct({
      ...root({ role: "AGENT", is_premium: 0 }),
      ...nested({ role: "AGENT", is_premium: 1 }),
    })
    expect(outcome.kind).toBe("stamped")
    expect(outcome.kind === "stamped" && outcome.changes.map((c) => `${c.path}=${c.to}`)).toEqual([
      "user_config=AGENT_FREE",
      "cashoffers.user_config=AGENT_PREMIUM",
    ])
  })

  it("leaves a product that already names a role_v2 alone", () => {
    // Re-runnable: the backfill is the only writer of this key that derives it, so a hand-set eXp
    // tier must survive a second run. Being wrong here is how a $299 product becomes a $49 one.
    expect(planProduct(nested({ role: "AGENT", is_premium: 1, role_v2: "AGENT_EXP_ELITE" }))).toEqual({
      kind: "already",
      roles: ["AGENT_EXP_ELITE"],
    })
  })

  it("reports a role it cannot resolve instead of guessing one", () => {
    expect(planProduct(nested({ role: "WIZARD", is_premium: 1 }))).toEqual({ kind: "unresolvable", roles: ["WIZARD"] })
    expect(planProduct(nested({ is_premium: 1 }))).toEqual({ kind: "unresolvable", roles: ["(none)"] })
  })

  it("reports a product with no user_config at all", () => {
    expect(planProduct({ renewal_cost: 2500 })).toEqual({ kind: "no_config" })
    expect(configSites({})).toEqual([])
  })

  it("never derives an Express Offers tier, however the pair is set", () => {
    const pairs = [
      { role: "AGENT", is_premium: 0 },
      { role: "AGENT", is_premium: 1 },
      { role: "TEAMOWNER", is_premium: 1 },
      { role: "INVESTOR", is_premium: 1 },
      { role: "SHELL", is_premium: 0 },
    ]
    const derived = pairs.flatMap((pair) => {
      const outcome = planProduct(nested(pair))
      return outcome.kind === "stamped" ? outcome.changes.map((c) => c.to) : []
    })
    expect(derived.filter((role) => role.startsWith("AGENT_EXP_"))).toEqual([])
  })
})

describe("applyPlan", () => {
  it("adds role_v2 and changes nothing else", () => {
    const data = { renewal_cost: 2500, ...nested({ role: "AGENT", is_premium: 1, is_team_plan: false }) }
    const next = applyPlan(data, planProduct(data))
    expect(next).toEqual({
      renewal_cost: 2500,
      cashoffers: {
        managed: true,
        user_config: { role: "AGENT", is_premium: 1, is_team_plan: false, role_v2: "AGENT_PREMIUM" },
      },
    })
  })

  it("does not mutate the product it was given", () => {
    const data = nested({ role: "AGENT", is_premium: 1 })
    applyPlan(data, planProduct(data))
    expect(data.cashoffers.user_config).not.toHaveProperty("role_v2")
  })

  it("is a no-op for every outcome that is not a stamp", () => {
    const untouched = nested({ role: "AGENT", is_premium: 1, role_v2: "AGENT_EXP_PRO" })
    expect(applyPlan(untouched, planProduct(untouched))).toBe(untouched)
    const orphan = { renewal_cost: 0 }
    expect(applyPlan(orphan, planProduct(orphan))).toBe(orphan)
  })

  it("is idempotent: a second run stamps nothing", () => {
    const data = nested({ role: "AGENT", is_premium: 1 })
    const once = applyPlan(data, planProduct(data))
    expect(planProduct(once).kind).toBe("already")
    expect(applyPlan(once, planProduct(once))).toBe(once)
  })
})
