/**
 * Integration tests for default HomeUptick subscription seeding.
 *
 * Verifies that seedHomeUptickSubscription always creates a Homeuptick_Subscriptions
 * row — using the product template when available, or default values when not.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { seedHomeUptickSubscription } from "@api/use-cases/subscription/purchase-helpers"
import { makeLogger } from "./helpers/test-doubles"
import type { ProductData } from "@api/domain/types/product-data.types"

function makeHuRepo() {
  return {
    create: vi.fn().mockResolvedValue({ homeuptick_id: 1 }),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findActiveByUserId: vi.fn(),
    update: vi.fn(),
  }
}

describe("seedHomeUptickSubscription — default config", () => {
  let logger: ReturnType<typeof makeLogger>
  let huRepo: ReturnType<typeof makeHuRepo>

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
    huRepo = makeHuRepo()
  })

  it("seeds HU row with product template when homeuptick.enabled = true", async () => {
    const productData: ProductData = {
      homeuptick: {
        enabled: true,
        base_contacts: 1000,
        contacts_per_tier: 500,
        price_per_tier: 7500,
      },
    }

    await seedHomeUptickSubscription(
      { logger, homeUptickSubscriptionRepository: huRepo as any },
      { userId: 42, productData }
    )

    expect(huRepo.create).toHaveBeenCalledTimes(1)
    const created = huRepo.create.mock.calls[0][0]
    expect(created.user_id).toBe(42)
    expect(created.base_contacts).toBe(1000)
    expect(created.contacts_per_tier).toBe(500)
    expect(created.price_per_tier).toBe(7500)
    expect(created.active).toBe(1)
  })

  it("seeds HU row with defaults when product has no homeuptick config", async () => {
    const productData: ProductData = {
      renewal_cost: 25000,
      duration: "monthly",
    }

    await seedHomeUptickSubscription(
      { logger, homeUptickSubscriptionRepository: huRepo as any },
      { userId: 42, productData }
    )

    expect(huRepo.create).toHaveBeenCalledTimes(1)
    const created = huRepo.create.mock.calls[0][0]
    expect(created.user_id).toBe(42)
    expect(created.base_contacts).toBe(500)
    expect(created.contacts_per_tier).toBe(500)
    expect(created.price_per_tier).toBe(0)
    expect(created.active).toBe(1)
    expect(created.free_trial_contacts).toBeNull()
    expect(created.free_trial_days).toBeNull()
    expect(created.free_trial_ends).toBeNull()
  })

  it("seeds HU row with defaults when productData is undefined", async () => {
    await seedHomeUptickSubscription(
      { logger, homeUptickSubscriptionRepository: huRepo as any },
      { userId: 42, productData: undefined }
    )

    expect(huRepo.create).toHaveBeenCalledTimes(1)
    const created = huRepo.create.mock.calls[0][0]
    expect(created.base_contacts).toBe(500)
    expect(created.contacts_per_tier).toBe(500)
    expect(created.price_per_tier).toBe(0)
  })

  it("seeds HU row with defaults when homeuptick.enabled = false", async () => {
    const productData: ProductData = {
      homeuptick: {
        enabled: false,
        base_contacts: 1000,
      },
    }

    await seedHomeUptickSubscription(
      { logger, homeUptickSubscriptionRepository: huRepo as any },
      { userId: 42, productData }
    )

    expect(huRepo.create).toHaveBeenCalledTimes(1)
    const created = huRepo.create.mock.calls[0][0]
    // Falls back to defaults because enabled=false
    expect(created.base_contacts).toBe(500)
    expect(created.contacts_per_tier).toBe(500)
    expect(created.price_per_tier).toBe(0)
  })

  it("seeds free trial fields when product template includes them", async () => {
    const productData: ProductData = {
      homeuptick: {
        enabled: true,
        base_contacts: 500,
        contacts_per_tier: 500,
        price_per_tier: 5000,
        free_trial: {
          enabled: true,
          contacts: 100,
          duration_days: 90,
        },
      },
    }

    await seedHomeUptickSubscription(
      { logger, homeUptickSubscriptionRepository: huRepo as any },
      { userId: 42, productData }
    )

    expect(huRepo.create).toHaveBeenCalledTimes(1)
    const created = huRepo.create.mock.calls[0][0]
    expect(created.free_trial_contacts).toBe(100)
    expect(created.free_trial_days).toBe(90)
    expect(created.free_trial_ends).toBeInstanceOf(Date)
    // free_trial_ends should be ~90 days from now
    const expectedDate = new Date()
    expectedDate.setDate(expectedDate.getDate() + 90)
    const diff = Math.abs(created.free_trial_ends!.getTime() - expectedDate.getTime())
    expect(diff).toBeLessThan(5000) // within 5 seconds
  })

  it("logs whether default config was used", async () => {
    await seedHomeUptickSubscription(
      { logger, homeUptickSubscriptionRepository: huRepo as any },
      { userId: 42, productData: undefined }
    )

    expect(logger.info).toHaveBeenCalledWith(
      "Seeded HomeUptick subscription from product template",
      expect.objectContaining({ usedDefault: true })
    )
  })
})
