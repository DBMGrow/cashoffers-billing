import { describe, it, expect } from "vitest"
import {
  evaluatePromo,
  normalizePromoCode,
  type PromoDefinition,
  type PromoEvaluationContext,
} from "./promo-evaluation"

const NOW = new Date("2026-10-01T12:00:00Z")

function promo(overrides: Partial<PromoDefinition> = {}): PromoDefinition {
  return {
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
    ends_at: new Date("2026-12-31T00:00:00Z"),
    active: true,
    new_users_only: true,
    campaign: "eXpCon 2026",
    ...overrides,
  }
}

// ExpressOffers Pro through the manage flow: no signup fee, $49 a month
const manageProPricing = { signupFee: 0, renewalCost: 4900, productDuration: "monthly", initialAmount: 4900 }

function ctx(overrides: Partial<PromoEvaluationContext> = {}): PromoEvaluationContext {
  return {
    product: { product_id: 70, whitelabel_code: "EXP", role_v2: "AGENT_EXP_PRO" },
    pricing: manageProPricing,
    now: NOW,
    priorRedemptionsForUser: 0,
    totalRedemptions: 0,
    isNewCustomer: true,
    ...overrides,
  }
}

describe("normalizePromoCode", () => {
  it("uppercases and trims, and treats blank as no code", () => {
    expect(normalizePromoCode("  expcon ")).toBe("EXPCON")
    expect(normalizePromoCode("")).toBeNull()
    expect(normalizePromoCode("   ")).toBeNull()
    expect(normalizePromoCode(null)).toBeNull()
  })
})

describe("evaluatePromo: first month free", () => {
  it("zeroes the first period and quotes the renewal at list price", () => {
    const result = evaluatePromo(promo(), ctx())
    expect(result).toMatchObject({
      ok: true,
      code: "EXPCON",
      originalAmount: 4900,
      discountAmount: 4900,
      chargedAmount: 0,
      thenAmount: 4900,
      display: "First month free",
      summary: "Promo EXPCON: First month free, $0.00 today, then $49.00/mo",
      periodsTotal: 1,
      periodsRemaining: 0,
    })
  })

  it("leaves a signup fee in place when it applies to the first period only", () => {
    const pricing = { signupFee: 4900, renewalCost: 4900, productDuration: "monthly", initialAmount: 9800 }
    const result = evaluatePromo(promo(), ctx({ pricing }))
    expect(result).toMatchObject({ ok: true, discountAmount: 4900, chargedAmount: 4900 })
  })

  it("waives the whole first charge, signup fee included, when applies_to is first_charge", () => {
    const pricing = { signupFee: 4900, renewalCost: 4900, productDuration: "monthly", initialAmount: 9800 }
    const result = evaluatePromo(promo({ applies_to: "first_charge" }), ctx({ pricing }))
    expect(result).toMatchObject({
      ok: true,
      discountAmount: 9800,
      chargedAmount: 0,
      display: "First month free, no signup fee",
    })
  })

  it("records the periods a multi-period code still owes", () => {
    const result = evaluatePromo(promo({ discount_value: 3 }), ctx())
    expect(result).toMatchObject({ ok: true, chargedAmount: 0, periodsTotal: 3, periodsRemaining: 2 })
  })

  it("says year for a yearly product", () => {
    const pricing = { signupFee: 0, renewalCost: 29900, productDuration: "yearly", initialAmount: 29900 }
    const result = evaluatePromo(promo(), ctx({ pricing }))
    expect(result).toMatchObject({ ok: true, display: "First year free" })
    if (result.ok) expect(result.summary).toBe("Promo EXPCON: First year free, $0.00 today, then $299.00/yr")
  })
})

describe("evaluatePromo: percent and amount", () => {
  it("takes a percentage off the first period", () => {
    const result = evaluatePromo(promo({ discount_type: "percent", discount_value: 50 }), ctx())
    expect(result).toMatchObject({
      ok: true,
      discountAmount: 2450,
      chargedAmount: 2450,
      display: "50% off your first month",
    })
  })

  it("never discounts more than 100 percent", () => {
    const result = evaluatePromo(promo({ discount_type: "percent", discount_value: 150 }), ctx())
    expect(result).toMatchObject({ ok: true, chargedAmount: 0 })
  })

  it("takes a fixed amount off, never below zero", () => {
    expect(evaluatePromo(promo({ discount_type: "amount", discount_value: 1000 }), ctx())).toMatchObject({
      ok: true,
      discountAmount: 1000,
      chargedAmount: 3900,
      display: "$10.00 off your first month",
    })
    expect(evaluatePromo(promo({ discount_type: "amount", discount_value: 99999 }), ctx())).toMatchObject({
      ok: true,
      discountAmount: 4900,
      chargedAmount: 0,
    })
  })
})

describe("evaluatePromo: refusals", () => {
  const cases: Array<[string, PromoDefinition | null, Partial<PromoEvaluationContext>, string]> = [
    ["an unknown code", null, {}, "NOT_FOUND"],
    ["an inactive code", promo({ active: false }), {}, "INACTIVE"],
    ["before it starts", promo({ starts_at: new Date("2026-11-01T00:00:00Z") }), {}, "NOT_STARTED"],
    ["after it ends", promo({ ends_at: new Date("2026-09-30T00:00:00Z") }), {}, "EXPIRED"],
    ["exactly at ends_at", promo({ ends_at: NOW }), {}, "EXPIRED"],
    [
      "another white label's product",
      promo(),
      { product: { product_id: 12, whitelabel_code: "KW", role_v2: "AGENT_EXP_PRO" } },
      "WRONG_WHITELABEL",
    ],
    ["a product outside product_ids", promo({ product_ids: [71] }), {}, "WRONG_PRODUCT"],
    [
      "a product selling another role (Elite)",
      promo(),
      { product: { product_id: 71, whitelabel_code: "EXP", role_v2: "AGENT_EXP_ELITE" } },
      "WRONG_PRODUCT",
    ],
    ["the total cap reached", promo({ max_redemptions: 100 }), { totalRedemptions: 100 }, "EXHAUSTED"],
    ["a buyer who already used it", promo(), { priorRedemptionsForUser: 1 }, "ALREADY_USED"],
    ["a buyer who already paid for a plan", promo(), { isNewCustomer: false }, "NEW_USERS_ONLY"],
    [
      "a free product (nothing to discount)",
      promo(),
      { pricing: { signupFee: 0, renewalCost: 0, productDuration: "monthly", initialAmount: 0 } },
      "NO_DISCOUNT",
    ],
  ]

  it.each(cases)("refuses %s", (_label, definition, overrides, reason) => {
    const result = evaluatePromo(definition, ctx(overrides))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe(reason)
      expect(result.message.length).toBeGreaterThan(0)
    }
  })

  it("matches the white label case-insensitively and lets an unscoped code apply anywhere", () => {
    expect(evaluatePromo(promo({ whitelabel_code: "exp" }), ctx()).ok).toBe(true)
    expect(
      evaluatePromo(
        promo({ whitelabel_code: null, product_roles: null, new_users_only: false }),
        ctx({ product: { product_id: 5, whitelabel_code: null } })
      ).ok
    ).toBe(true)
  })

  it("treats an unknown buyer as new (the validate endpoint has no buyer)", () => {
    expect(evaluatePromo(promo(), ctx({ isNewCustomer: undefined })).ok).toBe(true)
  })
})
