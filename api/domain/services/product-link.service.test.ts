import { describe, it, expect } from "vitest"
import { checkLinkedProduct, isOtherWhitelabelsProduct, linkedProductRejectionStatus } from "./product-link.service"

const expPro = { whitelabel_code: "EXP", product_type: "subscription" }
const platformPlan = { whitelabel_code: null, product_type: "subscription" }

describe("checkLinkedProduct", () => {
  it("allows a subscription product on the user's own white label", () => {
    expect(checkLinkedProduct(expPro, "EXP")).toEqual({ available: true })
  })

  it("rejects a missing product as NOT_FOUND", () => {
    expect(checkLinkedProduct(undefined, "EXP")).toEqual({ available: false, reason: "NOT_FOUND" })
    expect(checkLinkedProduct(null, "EXP")).toEqual({ available: false, reason: "NOT_FOUND" })
  })

  it("rejects another white label's product", () => {
    expect(checkLinkedProduct(expPro, "KW")).toEqual({ available: false, reason: "WHITELABEL_MISMATCH" })
  })

  // The strict half of the rule: an upgrade link for an eXp agent must never resolve to the
  // platform's own product, even though the plan lists offer shared NULL products to everyone.
  it("rejects a NULL-white-label product for a user whose white label has a code", () => {
    expect(checkLinkedProduct(platformPlan, "EXP")).toEqual({ available: false, reason: "WHITELABEL_MISMATCH" })
  })

  it("allows a NULL-white-label product for a user whose white label has no code", () => {
    expect(checkLinkedProduct(platformPlan, null)).toEqual({ available: true })
  })

  it("rejects a white-labelled product for a user with no white label code", () => {
    expect(checkLinkedProduct(expPro, null)).toEqual({ available: false, reason: "WHITELABEL_MISMATCH" })
  })

  it("matches the code exactly, case included", () => {
    expect(checkLinkedProduct(expPro, "exp")).toEqual({ available: false, reason: "WHITELABEL_MISMATCH" })
  })

  it("rejects a product that is not a subscription", () => {
    expect(checkLinkedProduct({ whitelabel_code: "EXP", product_type: "one-time" }, "EXP")).toEqual({
      available: false,
      reason: "NOT_SUBSCRIPTION",
    })
  })
})

describe("isOtherWhitelabelsProduct", () => {
  it("is false for the user's own white label", () => {
    expect(isOtherWhitelabelsProduct("EXP", "EXP")).toBe(false)
  })

  it("is false for a shared (NULL) product, whatever the user's white label", () => {
    expect(isOtherWhitelabelsProduct(null, "EXP")).toBe(false)
    expect(isOtherWhitelabelsProduct(null, null)).toBe(false)
  })

  it("is true for another white label's product", () => {
    expect(isOtherWhitelabelsProduct("EXP", "KW")).toBe(true)
    expect(isOtherWhitelabelsProduct("EXP", null)).toBe(true)
  })
})

describe("linkedProductRejectionStatus", () => {
  it("answers 404 for a missing product and 403 otherwise", () => {
    expect(linkedProductRejectionStatus("NOT_FOUND")).toBe(404)
    expect(linkedProductRejectionStatus("WHITELABEL_MISMATCH")).toBe(403)
    expect(linkedProductRejectionStatus("NOT_SUBSCRIPTION")).toBe(403)
  })
})

describe("checkLinkedProduct for a role that may not buy HomeUptick-only", () => {
  const hu = { whitelabel_code: "EXP", product_type: "subscription", product_category: "homeuptick_only" }
  it("refuses a homeuptick_only product only when told to", () => {
    expect(checkLinkedProduct(hu, "EXP", { homeUptickOnlyAllowed: false })).toEqual({
      available: false,
      reason: "NOT_OFFERED_TO_ROLE",
    })
    expect(checkLinkedProduct(hu, "EXP")).toEqual({ available: true })
    expect(
      checkLinkedProduct({ ...hu, product_category: "premium_cashoffers" }, "EXP", { homeUptickOnlyAllowed: false })
    ).toEqual({ available: true })
    expect(linkedProductRejectionStatus("NOT_OFFERED_TO_ROLE")).toBe(403)
  })
})
