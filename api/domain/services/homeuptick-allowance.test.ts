import { describe, it, expect } from "vitest"
import { HOMEUPTICK_DEFAULTS, homeUptickAllowance } from "./homeuptick-allowance"

describe("homeUptickAllowance", () => {
  it("is null when the product does not turn HomeUptick on", () => {
    expect(homeUptickAllowance(undefined)).toBeNull()
    expect(homeUptickAllowance(null)).toBeNull()
    expect(homeUptickAllowance({ enabled: false, base_contacts: 500 })).toBeNull()
  })

  it("keeps an explicit 0 included contacts (every contact billed)", () => {
    expect(homeUptickAllowance({ enabled: true, base_contacts: 0 })).toEqual({
      included: 0,
      perTier: 500,
      tierPrice: 7500,
    })
  })

  it("falls back to the seeding defaults, one per missing field", () => {
    expect(homeUptickAllowance({ enabled: true })).toEqual({ included: 500, perTier: 500, tierPrice: 7500 })
    expect(
      homeUptickAllowance({ enabled: true, base_contacts: 1000, contacts_per_tier: 250, price_per_tier: 5000 })
    ).toEqual({
      included: 1000,
      perTier: 250,
      tierPrice: 5000,
    })
  })

  it("pins the defaults seedHomeUptickSubscription uses", () => {
    expect(HOMEUPTICK_DEFAULTS).toEqual({ base_contacts: 500, contacts_per_tier: 500, price_per_tier: 7500 })
  })
})
