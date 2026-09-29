import { describe, it, expect } from "vitest"
import { CreateProductRequestSchema, ProductUserConfigSchema } from "./schemas"

/**
 * Product `user_config` role validation: `role_v2` and the legacy `role` must agree, where `role`
 * is the legacy role `role_v2` resolves to (mirror of the registry's `ROLES[role].legacy`).
 */
const config = (fields: Record<string, unknown>): Record<string, unknown> => ({ white_label_id: null, ...fields })

describe("ProductUserConfigSchema role agreement", () => {
  it.each([
    ["AGENT_PREMIUM", "AGENT"],
    ["AGENT_FREE", "AGENT"],
    ["AGENT_LITE", "AGENT"],
    ["AGENT_EXP_GUEST", "AGENT"],
    ["AGENT_EXP_PRO", "AGENT"],
    ["AGENT_EXP_ELITE", "AGENT"],
    ["TEAMOWNER", "TEAMOWNER"],
    ["INVESTOR", "INVESTOR"],
    ["HOMEUPTICK", "HOMEUPTICK"],
    ["SHELL", "SHELL"],
  ])("accepts role_v2 %s with role %s", (roleV2, role) => {
    expect(ProductUserConfigSchema.safeParse(config({ role_v2: roleV2, role })).success).toBe(true)
  })

  it.each([
    ["AGENT_EXP_PRO", "INVESTOR"],
    ["TEAMOWNER", "AGENT"],
    ["INVESTOR", "AGENT"],
    ["HOMEUPTICK", "SHELL"],
  ])("refuses role_v2 %s with role %s, naming the role it implies", (roleV2, role) => {
    const result = ProductUserConfigSchema.safeParse(config({ role_v2: roleV2, role }))
    expect(result.success).toBe(false)
    const issue = result.error!.issues.find((i) => i.path.join(".") === "role")
    expect(issue?.message).toContain(`role_v2 "${roleV2}"`)
    expect(issue?.message).toContain("which implies role")
  })

  it("accepts either half alone", () => {
    expect(ProductUserConfigSchema.safeParse(config({ role_v2: "AGENT_EXP_PRO" })).success).toBe(true)
    expect(ProductUserConfigSchema.safeParse(config({ role: "AGENT", is_premium: 1 })).success).toBe(true)
  })

  it("still refuses a config that names no role", () => {
    expect(ProductUserConfigSchema.safeParse(config({ is_premium: 1 })).success).toBe(false)
  })

  it("applies inside a create request, under cashoffers.user_config", () => {
    const body = {
      product_name: "ExpressOffers Pro",
      product_type: "subscription",
      product_category: "premium_cashoffers",
      price: 4900,
      data: { cashoffers: { managed: true, user_config: config({ role_v2: "AGENT_EXP_PRO", role: "TEAMOWNER" }) } },
    }
    expect(CreateProductRequestSchema.safeParse(body).success).toBe(false)
    body.data.cashoffers.user_config.role = "AGENT"
    expect(CreateProductRequestSchema.safeParse(body).success).toBe(true)
  })
})
