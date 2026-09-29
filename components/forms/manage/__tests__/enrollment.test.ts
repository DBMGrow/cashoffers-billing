import { describe, it, expect } from "vitest"
import { ENROLLMENT_DEFAULT_DESCRIPTION, enrollmentCopy, homeUptickLines, shouldAutoEnroll } from "../enrollment"

describe("enrollmentCopy", () => {
  it("names the plan for buy_product", () => {
    expect(enrollmentCopy("buy_product", "ExpressOffers Pro").description).toBe(
      "Add your card to start ExpressOffers Pro."
    )
    expect(enrollmentCopy("buy_product", null).description).not.toMatch(/HomeUptick/)
  })

  it("keeps the HomeUptick copy for the HomeUptick intents only", () => {
    expect(enrollmentCopy("homeuptick_only", "HU").description).toBe("Add your card on file to activate HomeUptick.")
    expect(enrollmentCopy("activate_homeuptick", null).description).toBe(
      "Add your card on file to activate HomeUptick."
    )
    expect(enrollmentCopy(null, null).description).toBe(ENROLLMENT_DEFAULT_DESCRIPTION)
    expect(ENROLLMENT_DEFAULT_DESCRIPTION).not.toMatch(/HomeUptick/)
  })
})

describe("shouldAutoEnroll (plain /manage)", () => {
  const pro = { product_id: 70, product_name: "ExpressOffers Pro" }

  it("opens a Guest's plain /manage on enrollment for their Pro upgrade", () => {
    expect(
      shouldAutoEnroll({
        success: "success",
        data: { eligible: true, intent: "buy_product", product_category: "premium_cashoffers", products: [pro] },
      })
    ).toBe(true)
  })

  it("keeps the HomeUptick enrollments auto-opening", () => {
    expect(
      shouldAutoEnroll({ success: "success", data: { eligible: true, intent: "homeuptick_only", products: [{}] } })
    ).toBe(true)
    expect(
      shouldAutoEnroll({ success: "success", data: { eligible: true, intent: "activate_homeuptick", products: [{}] } })
    ).toBe(true)
  })

  it("stays on the dashboard when there is nothing to buy, no intent, or an error", () => {
    expect(shouldAutoEnroll({ success: "success", data: { eligible: false, intent: null, products: [] } })).toBe(false)
    expect(shouldAutoEnroll({ success: "success", data: { eligible: true, intent: null, products: [pro] } })).toBe(
      false
    )
    expect(
      shouldAutoEnroll({ success: "success", data: { eligible: true, intent: "buy_product", products: [] } })
    ).toBe(false)
    expect(shouldAutoEnroll({ success: "error" })).toBe(false)
    expect(shouldAutoEnroll(null)).toBe(false)
  })
})

describe("homeUptickLines", () => {
  it("shows nothing when the plan does not turn HomeUptick on", () => {
    expect(homeUptickLines(undefined, "month")).toEqual([])
    expect(homeUptickLines({ enabled: false, base_contacts: 500 }, "month")).toEqual([])
  })

  it("shows nothing when the plan includes no contacts", () => {
    expect(homeUptickLines({ enabled: true, base_contacts: 0 }, "month")).toEqual([])
    expect(homeUptickLines({ enabled: true, base_contacts: 0, price_per_tier: 7550 }, "year")).toEqual([])
  })

  it("uses the backend defaults (500 included, $75 per 500) for missing fields", () => {
    expect(homeUptickLines({ enabled: true }, "month")).toEqual([
      { label: "Included", value: "500 contacts" },
      { label: "Overage", value: "$75 / month per additional 500 contacts" },
    ])
  })

  it("formats a non-whole tier price with cents", () => {
    expect(homeUptickLines({ enabled: true, base_contacts: 500, price_per_tier: 7550 }, "year")[1].value).toBe(
      "$75.50 / year per additional 500 contacts"
    )
  })
})
