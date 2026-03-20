import { describe, it, expect, beforeEach } from "vitest"
import { GetSubscriptionsUseCase } from "./get-subscriptions.use-case"
import { ConsoleLogger } from "@api/infrastructure/logging/console.logger"

class MockSubscriptionRepository {
  private subscriptions: any[] = []

  async findById(id: number) {
    return this.subscriptions.find((s) => s.subscription_id === id) || null
  }

  async findByUserId(userId: number) {
    return this.subscriptions.filter((s) => s.user_id === userId)
  }

  async findAll() {
    return [...this.subscriptions]
  }

  async create(data: any) {
    const sub = { subscription_id: this.subscriptions.length + 1, ...data }
    this.subscriptions.push(sub)
    return sub
  }

  async update(id: number, data: any) {
    const idx = this.subscriptions.findIndex((s) => s.subscription_id === id)
    if (idx === -1) return null
    this.subscriptions[idx] = { ...this.subscriptions[idx], ...data }
    return this.subscriptions[idx]
  }

  async delete(): Promise<void> {}

  addSubscription(sub: any) {
    this.subscriptions.push(sub)
  }
}

describe("GetSubscriptionsUseCase", () => {
  let useCase: GetSubscriptionsUseCase
  let subscriptionRepo: MockSubscriptionRepository

  beforeEach(() => {
    subscriptionRepo = new MockSubscriptionRepository()

    useCase = new GetSubscriptionsUseCase({
      logger: new ConsoleLogger(),
      subscriptionRepository: subscriptionRepo as any,
    })
  })

  describe("Input Validation", () => {
    it("should fail with negative page", async () => {
      const result = await useCase.execute({ page: -1 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("GET_SUBSCRIPTIONS_VALIDATION_ERROR")
      }
    })

    it("should fail with zero limit", async () => {
      const result = await useCase.execute({ limit: 0 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("GET_SUBSCRIPTIONS_VALIDATION_ERROR")
      }
    })
  })

  describe("Get All Subscriptions", () => {
    beforeEach(() => {
      for (let i = 1; i <= 5; i++) {
        subscriptionRepo.addSubscription({
          subscription_id: i,
          user_id: i * 10,
          subscription_name: `Plan ${i}`,
          amount: 25000,
          duration: "monthly",
          status: "active",
          renewal_date: new Date("2026-04-01"),
          cancel_on_renewal: 0,
          downgrade_on_renewal: 0,
          createdAt: new Date(),
        })
      }
    })

    it("should return all subscriptions when no userId provided", async () => {
      const result = await useCase.execute({})

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.total).toBe(5)
        expect(result.data.subscriptions).toHaveLength(5)
      }
    })

    it("should return mapped subscription fields", async () => {
      const result = await useCase.execute({})

      expect(result.success).toBe(true)
      if (result.success) {
        const first = result.data.subscriptions[0]
        expect(first.subscriptionId).toBe(1)
        expect(first.userId).toBe(10)
        expect(first.subscriptionName).toBe("Plan 1")
        expect(first.amount).toBe(25000)
        expect(first.status).toBe("active")
        expect(first.cancelOnRenewal).toBe(false)
        expect(first.downgradeOnRenewal).toBe(false)
      }
    })

    it("should apply default pagination (page=1, limit=20)", async () => {
      const result = await useCase.execute({})

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(1)
        expect(result.data.limit).toBe(20)
      }
    })

    it("should paginate correctly", async () => {
      const result = await useCase.execute({ page: 2, limit: 2 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.subscriptions).toHaveLength(2)
        expect(result.data.subscriptions[0].subscriptionId).toBe(3)
        expect(result.data.total).toBe(5)
        expect(result.data.page).toBe(2)
        expect(result.data.limit).toBe(2)
      }
    })

    it("should return empty page when offset exceeds total", async () => {
      const result = await useCase.execute({ page: 10, limit: 20 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.subscriptions).toHaveLength(0)
        expect(result.data.total).toBe(5)
      }
    })
  })

  describe("Get Subscriptions by User", () => {
    beforeEach(() => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        subscription_name: "User Plan",
        amount: 25000,
        duration: "monthly",
        status: "active",
        renewal_date: new Date("2026-04-01"),
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        createdAt: new Date(),
      })
      subscriptionRepo.addSubscription({
        subscription_id: 2,
        user_id: 20,
        subscription_name: "Other User Plan",
        amount: 15000,
        duration: "monthly",
        status: "active",
        renewal_date: new Date("2026-04-01"),
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        createdAt: new Date(),
      })
    })

    it("should only return subscriptions for the specified user", async () => {
      const result = await useCase.execute({ userId: 10 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.total).toBe(1)
        expect(result.data.subscriptions).toHaveLength(1)
        expect(result.data.subscriptions[0].userId).toBe(10)
      }
    })

    it("should return empty array for user with no subscriptions", async () => {
      const result = await useCase.execute({ userId: 999 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.total).toBe(0)
        expect(result.data.subscriptions).toHaveLength(0)
      }
    })
  })

  describe("Empty Database", () => {
    it("should succeed with empty results", async () => {
      const result = await useCase.execute({})

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.subscriptions).toHaveLength(0)
        expect(result.data.total).toBe(0)
      }
    })
  })
})
