import { describe, it, expect } from "vitest"
import {
  intentForCategory,
  mayBeOfferedHomeUptickOnly,
  selectUpgradeProduct,
  upgradeTargetFor,
} from "./enrollment-intent.service"

const pro = {
  product_id: 70,
  product_type: "subscription",
  whitelabel_code: "EXP",
  data: { cashoffers: { managed: true, user_config: { role: "AGENT", role_v2: "AGENT_EXP_PRO" } } },
}

describe("enrollment intent rules", () => {
  it("upgrades a Guest to Pro and nobody else", () => {
    expect(upgradeTargetFor("AGENT_EXP_GUEST")).toBe("AGENT_EXP_PRO")
    expect(upgradeTargetFor("AGENT_EXP_PRO")).toBeNull()
    expect(upgradeTargetFor("AGENT_FREE")).toBeNull()
    expect(upgradeTargetFor(null)).toBeNull()
  })

  it("never offers HomeUptick-only to a Guest", () => {
    expect(mayBeOfferedHomeUptickOnly("AGENT_EXP_GUEST")).toBe(false)
    expect(mayBeOfferedHomeUptickOnly("AGENT_EXP_PRO")).toBe(true)
    expect(mayBeOfferedHomeUptickOnly("AGENT_FREE")).toBe(true)
    expect(mayBeOfferedHomeUptickOnly(null)).toBe(true)
  })

  it("maps each category to its intent", () => {
    expect(intentForCategory("homeuptick_only")).toBe("homeuptick_only")
    expect(intentForCategory("external_cashoffers")).toBe("activate_homeuptick")
    expect(intentForCategory("premium_cashoffers")).toBe("buy_product")
  })
})

describe("selectUpgradeProduct (mirror of api-v2 upgradeDestination)", () => {
  it("picks the one subscription product for the target in the exact white label", () => {
    expect(selectUpgradeProduct([pro], "AGENT_EXP_PRO", "EXP")).toEqual({ product: pro })
  })

  it("reads role_v2 from JSON-string data too", () => {
    const stringData = { ...pro, data: JSON.stringify(pro.data) }
    expect(selectUpgradeProduct([stringData], "AGENT_EXP_PRO", "EXP")).toEqual({ product: stringData })
  })

  it("misses on zero or several matches", () => {
    expect(selectUpgradeProduct([], "AGENT_EXP_PRO", "EXP")).toHaveProperty("reason")
    expect(selectUpgradeProduct([pro, { ...pro, product_id: 71 }], "AGENT_EXP_PRO", "EXP")).toEqual({
      reason: "2 products for AGENT_EXP_PRO in EXP",
    })
  })

  it("does not match another white label, a NULL one, a one-time product, or a legacy-only config", () => {
    const candidates = [
      { ...pro, whitelabel_code: "KW" },
      { ...pro, whitelabel_code: null },
      { ...pro, product_type: "one-time" },
      { ...pro, data: { cashoffers: { managed: true, user_config: { role: "AGENT", is_premium: 1 } } } },
      { ...pro, data: { user_config: { role_v2: "AGENT_EXP_PRO" } } },
    ]
    expect(selectUpgradeProduct(candidates, "AGENT_EXP_PRO", "EXP")).toHaveProperty("reason")
  })

  it("matches NULL to NULL for a user with no white label code", () => {
    const platform = { ...pro, whitelabel_code: null }
    expect(selectUpgradeProduct([platform], "AGENT_EXP_PRO", null)).toEqual({ product: platform })
  })
})
