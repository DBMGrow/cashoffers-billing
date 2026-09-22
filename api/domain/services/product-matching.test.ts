import { describe, it, expect } from "vitest"
import {
  buildProductIndex,
  findMatchingProduct,
  makeProductKey,
  parseProductData,
  resolveSubscriptionCharacteristics,
  buildNewSubscriptionData,
  type ProductRow,
  type SubscriptionRow,
} from "./product-matching"

const product = (
  product_id: number,
  product_name: string,
  userConfig: Record<string, unknown>,
  renewal_cost: number,
  whitelabel_code: string | null = "EXP"
): ProductRow => ({
  product_id,
  product_name,
  whitelabel_code,
  price: 0,
  data: JSON.stringify({ renewal_cost, duration: "monthly", cashoffers: { managed: true, user_config: userConfig } }),
})

const subscription = (overrides: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  subscription_id: 1,
  subscription_name: "sub",
  user_id: 10,
  product_id: null,
  amount: 4900,
  duration: "monthly",
  status: "active",
  data: null,
  user_role: "AGENT",
  user_role_v2: null,
  user_is_premium: 1,
  user_team_id: null,
  user_whitelabel_id: 7,
  whitelabel_code: "EXP",
  ...overrides,
})

/**
 * AC24, and the real close of Q9.
 *
 * The two products below are the two eXp paid tiers as they exist in the database: same white
 * label, same legacy role, same premium bit, $250 a month apart. Everything else in this file is
 * about not breaking the products that already reconcile.
 */
describe("Express Offers Pro and Elite resolve to different products (AC24)", () => {
  const pro = product(101, "Express Offers Pro", { role: "AGENT", is_premium: 1, role_v2: "AGENT_EXP_PRO" }, 4900)
  const elite = product(
    102,
    "Express Offers Elite",
    { role: "AGENT", is_premium: 1, role_v2: "AGENT_EXP_ELITE" },
    29900
  )
  const index = buildProductIndex([pro, elite].map(parseProductData))

  it("gives the two tiers different index keys", () => {
    const parsed = [pro, elite].map(parseProductData)
    const keys = parsed.map((p) => makeProductKey(p.whitelabel_code, p.role_v2, p.is_team_plan, p.team_members))
    expect(new Set(keys).size).toBe(2)
    expect(keys).toEqual(["EXP|AGENT_EXP_PRO|0", "EXP|AGENT_EXP_ELITE|0"])
  })

  it("matches a Pro subscription to the Pro product", () => {
    const sub = subscription({ amount: 4900, user_role_v2: "AGENT_EXP_PRO" })
    const characteristics = resolveSubscriptionCharacteristics(sub, {})
    const { product: matched } = findMatchingProduct(index, "EXP", characteristics, sub.amount)
    expect(matched?.product_id).toBe(101)
  })

  it("matches an Elite subscription to the Elite product", () => {
    const sub = subscription({ amount: 29900, user_role_v2: "AGENT_EXP_ELITE" })
    const characteristics = resolveSubscriptionCharacteristics(sub, {})
    const { product: matched } = findMatchingProduct(index, "EXP", characteristics, sub.amount)
    expect(matched?.product_id).toBe(102)
  })

  it("resolves the two to different products in the same run", () => {
    const proMatch = findMatchingProduct(
      index,
      "EXP",
      resolveSubscriptionCharacteristics(subscription({ amount: 4900, user_role_v2: "AGENT_EXP_PRO" }), {}),
      4900
    )
    const eliteMatch = findMatchingProduct(
      index,
      "EXP",
      resolveSubscriptionCharacteristics(subscription({ amount: 29900, user_role_v2: "AGENT_EXP_ELITE" }), {}),
      29900
    )
    expect(proMatch.product?.product_id).not.toBe(eliteMatch.product?.product_id)
  })

  it("refuses to price an Elite as a Pro when the price moves, instead of matching the cheaper one", () => {
    // The defect this closes. On the old key both products sat in `EXP|AGENT|0` and only the exact
    // price told them apart, so an Elite whose amount no longer matched fell through to the Pro
    // product and reconciled onto a $49 plan. Now it reports rather than guesses.
    const sub = subscription({ amount: 27900, user_role_v2: "AGENT_EXP_ELITE" })
    const { product: matched, reason } = findMatchingProduct(
      index,
      "EXP",
      resolveSubscriptionCharacteristics(sub, {}),
      sub.amount
    )
    expect(matched).toBeNull()
    expect(reason).toContain("PRICE MISMATCH")
    expect(reason).toContain("AGENT_EXP_ELITE")
  })

  it("would have collided on the legacy key, which is what makes this test worth having", () => {
    // Guard against a silent regression to keying on `role`: if both tiers ever produce one key
    // again, every assertion above still passes on price alone and this is the one that fails.
    const parsed = [pro, elite].map(parseProductData)
    const legacyKeys = parsed.map((p) => `${p.whitelabel_code}|${p.role}|0`)
    expect(new Set(legacyKeys).size).toBe(1)
  })
})

describe("products that already reconcile keep reconciling", () => {
  const free = product(1, "Free", { role: "AGENT", is_premium: 0 }, 0, null)
  const premium = product(2, "Premium Monthly", { role: "AGENT", is_premium: 1 }, 2500, null)
  const team = product(
    3,
    "Team Monthly",
    { role: "TEAMOWNER", is_premium: 1, is_team_plan: true, team_members: 6 },
    9900,
    null
  )
  const investor = product(4, "Investor Monthly", { role: "INVESTOR", is_premium: 1 }, 5000, null)
  const index = buildProductIndex([free, premium, team, investor].map(parseProductData))

  it("derives a role_v2 for a product that carries only the legacy pair", () => {
    expect(parseProductData(free).role_v2).toBe("AGENT_FREE")
    expect(parseProductData(premium).role_v2).toBe("AGENT_PREMIUM")
    expect(parseProductData(team).role_v2).toBe("TEAMOWNER")
    expect(parseProductData(investor).role_v2).toBe("INVESTOR")
  })

  it("matches a premium agent subscription with no role_v2 anywhere", () => {
    const sub = subscription({ amount: 2500, whitelabel_code: null, user_role: "AGENT", user_is_premium: 1 })
    const { product: matched } = findMatchingProduct(
      index,
      null,
      resolveSubscriptionCharacteristics(sub, {}),
      sub.amount
    )
    expect(matched?.product_id).toBe(2)
  })

  it("matches a free agent subscription without falling onto the premium product", () => {
    const sub = subscription({ amount: 0, whitelabel_code: null, user_role: "AGENT", user_is_premium: 0 })
    const { product: matched } = findMatchingProduct(
      index,
      null,
      resolveSubscriptionCharacteristics(sub, {}),
      sub.amount
    )
    expect(matched?.product_id).toBe(1)
  })

  it("matches a team subscription on team_members", () => {
    const sub = subscription({
      amount: 9900,
      whitelabel_code: null,
      user_role: "TEAMOWNER",
      data: JSON.stringify({ user_config: { role: "TEAMOWNER", team_members: 6 } }),
    })
    const characteristics = resolveSubscriptionCharacteristics(sub, JSON.parse(sub.data!))
    expect(characteristics.is_team_plan).toBe(true)
    expect(findMatchingProduct(index, null, characteristics, sub.amount).product?.product_id).toBe(3)
  })

  it("falls back to a null-whitelabel product for a white-labelled user", () => {
    const sub = subscription({ amount: 5000, whitelabel_code: "EXP", user_role: "INVESTOR", user_is_premium: 1 })
    const { product: matched, reason } = findMatchingProduct(
      index,
      "EXP",
      resolveSubscriptionCharacteristics(sub, {}),
      sub.amount
    )
    expect(matched?.product_id).toBe(4)
    expect(reason).toBe("matched via null-whitelabel fallback")
  })
})

describe("the legacy-role fallback", () => {
  const premium = product(2, "Premium Monthly", { role: "AGENT", is_premium: 1 }, 25000, "iop")
  const index = buildProductIndex([premium].map(parseProductData))

  it("matches a subscription whose holder is on a different tier than their plan pays for", () => {
    // 38 live rows on staging look like this: an agent who lapsed to AGENT_FREE with a $250
    // subscription still open. The subscription records no tier of its own, so the only tier
    // available is the user's, and it is not the plan's. Keying on it strictly would fail the row.
    const sub = subscription({ amount: 25000, whitelabel_code: "iop", user_role: "AGENT", user_role_v2: "AGENT_FREE" })
    const result = findMatchingProduct(index, "iop", resolveSubscriptionCharacteristics(sub, {}), sub.amount)
    expect(result.product?.product_id).toBe(2)
    expect(result.viaLegacyRole).toBe(true)
    expect(result.reason).toContain("not recorded anywhere")
  })

  it("does not reach the fallback when the tier matches, so the match is never downgraded to a guess", () => {
    const sub = subscription({
      amount: 25000,
      whitelabel_code: "iop",
      user_role: "AGENT",
      user_role_v2: "AGENT_PREMIUM",
    })
    const result = findMatchingProduct(index, "iop", resolveSubscriptionCharacteristics(sub, {}), sub.amount)
    expect(result.product?.product_id).toBe(2)
    expect(result.viaLegacyRole).toBe(false)
  })

  it("still refuses when no price matches, however the role is read", () => {
    const sub = subscription({ amount: 999, whitelabel_code: "iop", user_role: "AGENT", user_role_v2: "AGENT_FREE" })
    const result = findMatchingProduct(index, "iop", resolveSubscriptionCharacteristics(sub, {}), sub.amount)
    expect(result.product).toBeNull()
  })

  it("keeps Pro and Elite apart even though they share a legacy bucket", () => {
    // The fallback groups by legacy role, which puts Pro and Elite back in one bucket. It must
    // never be reached by a subscription that names either, or the whole change is undone.
    const pro = product(101, "Pro", { role: "AGENT", is_premium: 1, role_v2: "AGENT_EXP_PRO" }, 4900)
    const elite = product(102, "Elite", { role: "AGENT", is_premium: 1, role_v2: "AGENT_EXP_ELITE" }, 29900)
    const expIndex = buildProductIndex([pro, elite].map(parseProductData))
    const sub = subscription({ amount: 29900, user_role_v2: "AGENT_EXP_ELITE" })
    const result = findMatchingProduct(expIndex, "EXP", resolveSubscriptionCharacteristics(sub, {}), sub.amount)
    expect(result.product?.product_id).toBe(102)
    expect(result.viaLegacyRole).toBe(false)
  })
})

describe("role resolution order", () => {
  it("prefers the subscription's own role_v2 over the user's", () => {
    const sub = subscription({ user_role_v2: "AGENT_PREMIUM" })
    const characteristics = resolveSubscriptionCharacteristics(sub, { user_config: { role_v2: "AGENT_EXP_ELITE" } })
    expect(characteristics.role_v2).toBe("AGENT_EXP_ELITE")
  })

  it("prefers the user's role_v2 over deriving one from the legacy pair", () => {
    // The pair says AGENT + premium, which derives to AGENT_PREMIUM. The column says Elite. A
    // derivation that won here would reconcile every Elite onto the Premium product.
    const sub = subscription({ user_role: "AGENT", user_is_premium: 1, user_role_v2: "AGENT_EXP_ELITE" })
    expect(resolveSubscriptionCharacteristics(sub, {}).role_v2).toBe("AGENT_EXP_ELITE")
  })

  it("prefers the subscription's own config over the user's column, which answers a different question", () => {
    // The config says what was bought; the column says what the user is now. Asking the user first
    // reconciles a plan against a person: a $250 agent plan whose holder has since become a WLADMIN
    // keys as WLADMIN, matches nothing, and reports as a failure that needs manual review.
    const sub = subscription({ user_role: "WLADMIN", user_role_v2: "WLADMIN" })
    const subData = { user_config: { role: "AGENT", is_premium: 1 } }
    expect(resolveSubscriptionCharacteristics(sub, subData).role_v2).toBe("AGENT_PREMIUM")
  })

  it("derives from the legacy pair when no column and no config carries a role", () => {
    const sub = subscription({ user_role: "AGENT", user_is_premium: 1, user_role_v2: null })
    expect(resolveSubscriptionCharacteristics(sub, {}).role_v2).toBe("AGENT_PREMIUM")
  })

  it("ignores a role_v2 that is not a role rather than keying on it", () => {
    const sub = subscription({ user_role: "AGENT", user_is_premium: 0, user_role_v2: "AGENT_EXP_PLATINUM" })
    expect(resolveSubscriptionCharacteristics(sub, {}).role_v2).toBe("AGENT_FREE")
  })

  it("keys a product naming no resolvable role on its own bucket, not an empty one", () => {
    const orphan = parseProductData(product(9, "Orphan", { role: "WIZARD" }, 100))
    expect(orphan.role_v2).toBeNull()
    expect(makeProductKey(orphan.whitelabel_code, orphan.role_v2, false, 0)).toBe("EXP|__norole__|0")
  })
})

describe("buildNewSubscriptionData", () => {
  it("writes role_v2 beside the legacy pair, so the next run reads it instead of deriving it", () => {
    const parsed = parseProductData(
      product(101, "Express Offers Elite", { role: "AGENT", is_premium: 1, role_v2: "AGENT_EXP_ELITE" }, 29900)
    )
    const data = buildNewSubscriptionData(parsed, { team_id: null })
    const userConfig = data.user_config as Record<string, unknown>
    expect(userConfig.role_v2).toBe("AGENT_EXP_ELITE")
    expect(userConfig.role).toBe("AGENT")
    expect(userConfig.is_premium).toBe(1)
  })

  it("omits role_v2 rather than writing null when the product names no resolvable role", () => {
    const parsed = parseProductData(product(9, "Orphan", { role: "WIZARD" }, 100))
    const userConfig = buildNewSubscriptionData(parsed, { team_id: null }).user_config as Record<string, unknown>
    expect("role_v2" in userConfig).toBe(false)
  })
})
