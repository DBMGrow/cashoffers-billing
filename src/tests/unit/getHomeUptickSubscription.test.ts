import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the *deps* module, not the main module
vi.mock("@/utils/getHomeUptickSubscription.deps", () => ({
  getUserFromDB: vi.fn(),
  getSubscriptionFromDB: vi.fn(),
  getClientsCount: vi.fn(),
}))

import getHomeUptickSubscription from "@/utils/getHomeUptickSubscription"
import { getUserFromDB, getSubscriptionFromDB, getClientsCount } from "@/utils/getHomeUptickSubscription.deps"

const mGetUserFromDB = vi.mocked(getUserFromDB)
const mGetSubscriptionFromDB = vi.mocked(getSubscriptionFromDB)
const mGetClientsCount = vi.mocked(getClientsCount)

describe("getHomeUptickSubscription", () => {
  const user_id = 12345
  const base_contacts = 500
  const contacts_per_tier = 1000
  const price_per_tier = 7500

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null if user is not found", async () => {
    mGetUserFromDB.mockResolvedValue(undefined)
    const result = await getHomeUptickSubscription(user_id)
    expect(result).toBeNull()
  })

  it("returns null if user is inactive", async () => {
    mGetUserFromDB.mockResolvedValue({ active: 0 } as any)
    const result = await getHomeUptickSubscription(user_id)
    expect(result).toBeNull()
  })

  it("returns null if subscription is not found", async () => {
    mGetUserFromDB.mockResolvedValue({ active: 1 } as any)
    mGetSubscriptionFromDB.mockResolvedValue(undefined)

    const result = await getHomeUptickSubscription(user_id)
    expect(result).toBeNull()
  })

  it("returns null if clients count is zero", async () => {
    mGetUserFromDB.mockResolvedValue({ active: 1 } as any)
    mGetSubscriptionFromDB.mockResolvedValue({
      user_id,
      base_contacts,
      contacts_per_tier,
      price_per_tier,
    } as any)
    mGetClientsCount.mockResolvedValue({ data: { count: 0 } })
    const result = await getHomeUptickSubscription(user_id)

    expect(result).toBeNull()
  })

  it("calculates tier and amount correctly for base tier", async () => {
    mGetUserFromDB.mockResolvedValue({ active: 1 } as any)
    mGetSubscriptionFromDB.mockResolvedValue({
      user_id,
      base_contacts,
      contacts_per_tier,
      price_per_tier,
    } as any)
    mGetClientsCount.mockResolvedValue({ data: { count: 100 } })
    const result = await getHomeUptickSubscription(user_id)

    expect(result).toEqual({
      user_id,
      contacts: 100,
      contactsOnThisTier: 500,
      amount: 0,
      tier: 1,
    })
  })

  it("calculates tier and amount correctly for higher tier", async () => {
    mGetUserFromDB.mockResolvedValue({ active: 1 } as any)
    mGetSubscriptionFromDB.mockResolvedValue({
      user_id,
      base_contacts,
      contacts_per_tier,
      price_per_tier,
    } as any)

    mGetClientsCount.mockResolvedValue({ data: { count: 3479 } })
    const result = await getHomeUptickSubscription(user_id)

    expect(result).toEqual({
      user_id,
      amount: 22500,
      contacts: 3479,
      contactsOnThisTier: 3500,
      tier: 4,
    })
    mGetClientsCount.mockResolvedValue({ data: { count: 1000 } })
    const result2 = await getHomeUptickSubscription(user_id)

    expect(result2).toEqual({
      user_id,
      amount: 7500,
      contacts: 1000,
      contactsOnThisTier: 1500,
      tier: 2,
    })
    mGetClientsCount.mockResolvedValue({ data: { count: 501 } })
    const result3 = await getHomeUptickSubscription(user_id)

    expect(result3).toEqual({
      user_id,
      amount: 7500,
      contacts: 501,
      contactsOnThisTier: 1500,
      tier: 2,
    })
    mGetClientsCount.mockResolvedValue({ data: { count: 5000 } })
    const result4 = await getHomeUptickSubscription(user_id)

    expect(result4).toEqual({
      user_id,
      amount: 37500,
      contacts: 5000,
      contactsOnThisTier: 5500,
      tier: 6,
    })
  })
})
