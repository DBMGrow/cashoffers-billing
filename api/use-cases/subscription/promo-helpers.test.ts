import { describe, it, expect, vi } from "vitest"
import { quotePromo } from "./promo-helpers"
import type { PromoDefinition } from "@api/domain/services/promo-evaluation"

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
  ends_at: null,
  active: true,
  new_users_only: true,
}

const PRO = {
  product_id: 70,
  price: 4900,
  whitelabel_code: "EXP",
  data: {
    duration: "monthly",
    renewal_cost: 4900,
    cashoffers: { user_config: { role: "AGENT", role_v2: "AGENT_EXP_PRO" } },
  },
}

const deps = (promo: PromoDefinition | null = EXPCON) => ({
  productRepository: { findById: vi.fn(async () => PRO) },
  promoCodeRepository: { findByCode: vi.fn(async () => promo), countRedemptions: vi.fn(async () => 0) },
})

describe("quotePromo (GET /purchase/promo/validate)", () => {
  it("quotes the manage flow: $0 today, then $49/mo", async () => {
    const result = await quotePromo(deps(), { code: "expcon", productId: 70, flow: "manage" })
    expect(result).toMatchObject({
      ok: true,
      chargedAmount: 0,
      summary: "Promo EXPCON: First month free, $0.00 today, then $49.00/mo",
    })
  })

  it("quotes the signup flow with its signup fee still due (price is the fee when data.signup_fee is unset)", async () => {
    const result = await quotePromo(deps(), { code: "EXPCON", productId: 70, flow: "signup" })
    expect(result).toMatchObject({ ok: true, originalAmount: 9800, chargedAmount: 4900 })
  })

  it("refuses an unknown code", async () => {
    const result = await quotePromo(deps(null), { code: "NOPE", productId: 70, flow: "signup" })
    expect(result).toMatchObject({ ok: false, reason: "NOT_FOUND" })
  })
})
