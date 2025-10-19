import { describe, it, expect, vi, beforeEach, Mock } from "vitest"

// Mock the *deps* module, not the main module
vi.mock("@/utils/getHomeUptickSubscription.deps", () => ({
  getUserFromDB: vi.fn(),
  getSubscriptionFromDB: vi.fn(),
  getClientsCount: vi.fn(),
}))

import getHomeUptickSubscription from "@/utils/getHomeUptickSubscription"
import { getUserFromDB, getSubscriptionFromDB, getClientsCount } from "@/utils/getHomeUptickSubscription.deps"

describe("getHomeUptickSubscription", () => {
  const user_id = "user123"
  const apiKey = "test-api-key"
  const base_contacts = 500
  const contacts_per_tier = 1000
  const price_per_tier = 7500

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null if user is not found", async () => {
    ;(getUserFromDB as Mock).mockResolvedValue(null)
    const result = await getHomeUptickSubscription(user_id)
    expect(result).toBeNull()
  })

  it("returns null if user is inactive", async () => {
    ;(getUserFromDB as Mock).mockResolvedValue({ active: 0 })
    const result = await getHomeUptickSubscription(user_id)
    expect(result).toBeNull()
  })

  it("returns null if subscription is not found", async () => {
    ;(getUserFromDB as Mock).mockResolvedValue({ active: 1 })
    ;(getSubscriptionFromDB as Mock).mockResolvedValue(null)

    const result = await getHomeUptickSubscription(user_id)
    expect(result).toBeNull()
  })

  it("returns null if clients count is zero", async () => {
    ;(getUserFromDB as Mock).mockResolvedValue({ active: 1, homeuptick_api_key: apiKey })
    ;(getSubscriptionFromDB as Mock).mockResolvedValue({
      id: "sub1",
      user_id,
      base_contacts,
      contacts_per_tier,
      price_per_tier,
    })
    ;(getClientsCount as Mock).mockResolvedValue({ data: { count: 0 } })
    const result = await getHomeUptickSubscription(user_id)

    console.log(result)

    expect(result).toBeNull()
  })

  it("calculates tier and amount correctly for base tier", async () => {
    ;(getUserFromDB as Mock).mockResolvedValue({ active: 1, homeuptick_api_key: apiKey })
    ;(getSubscriptionFromDB as Mock).mockResolvedValue({
      id: "sub1",
      user_id,
      base_contacts,
      contacts_per_tier,
      price_per_tier,
    })
    ;(getClientsCount as Mock).mockResolvedValue({ data: { count: 100 } })
    const result = await getHomeUptickSubscription(user_id)

    expect(result).toEqual({
      id: "sub1",
      user_id,
      contacts: 100,
      contactsOnThisTier: 500,
      amount: 0,
      tier: 1,
    })
  })

  it("calculates tier and amount correctly for higher tier", async () => {
    ;(getUserFromDB as Mock).mockResolvedValue({ active: 1, homeuptick_api_key: apiKey })
    ;(getSubscriptionFromDB as Mock).mockResolvedValue({
      id: "sub1",
      user_id,
      base_contacts,
      contacts_per_tier,
      price_per_tier,
    })
    ;(getClientsCount as Mock).mockResolvedValue({ data: { count: 3479 } })
    const result = await getHomeUptickSubscription(user_id)

    expect(result).toEqual({
      id: "sub1",
      user_id,
      amount: 22500,
      contacts: 3479,
      contactsOnThisTier: 3500,
      tier: 4,
    })
    ;(getClientsCount as Mock).mockResolvedValue({ data: { count: 1000 } })
    const result2 = await getHomeUptickSubscription(user_id)

    expect(result2).toEqual({
      id: "sub1",
      user_id,
      amount: 7500,
      contacts: 1000,
      contactsOnThisTier: 1500,
      tier: 2,
    })
    ;(getClientsCount as Mock).mockResolvedValue({ data: { count: 501 } })
    const result3 = await getHomeUptickSubscription(user_id)

    expect(result3).toEqual({
      id: "sub1",
      user_id,
      amount: 7500,
      contacts: 501,
      contactsOnThisTier: 1500,
      tier: 2,
    })
    ;(getClientsCount as Mock).mockResolvedValue({ data: { count: 5000 } })
    const result4 = await getHomeUptickSubscription(user_id)

    expect(result4).toEqual({
      id: "sub1",
      user_id,
      amount: 37500,
      contacts: 5000,
      contactsOnThisTier: 5500,
      tier: 6,
    })
  })
})

// We recommend installing an extension to run vitest tests.
