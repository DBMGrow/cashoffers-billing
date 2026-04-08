import { describe, it, expect, beforeEach } from "vitest"
import { UpdateSubscriptionFieldsUseCase } from "./update-subscription-fields.use-case"
import { ConsoleLogger } from "@api/infrastructure/logging/console.logger"

class MockSubscriptionRepository {
  private subscriptions: any[] = []

  async findById(id: number) {
    return this.subscriptions.find((s) => s.subscription_id === id) || null
  }

  async findByUserId(userId: number) {
    return this.subscriptions.filter((s) => s.user_id === userId)
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

class MockTransactionRepository {
  private transactions: any[] = []

  async create(data: any) {
    const tx = { transaction_id: this.transactions.length + 1, ...data }
    this.transactions.push(tx)
    return tx
  }

  getAll() {
    return this.transactions
  }
}

describe("UpdateSubscriptionFieldsUseCase", () => {
  let useCase: UpdateSubscriptionFieldsUseCase
  let subscriptionRepo: MockSubscriptionRepository
  let transactionRepo: MockTransactionRepository

  beforeEach(() => {
    subscriptionRepo = new MockSubscriptionRepository()
    transactionRepo = new MockTransactionRepository()

    useCase = new UpdateSubscriptionFieldsUseCase({
      logger: new ConsoleLogger(),
      subscriptionRepository: subscriptionRepo as any,
      transactionRepository: transactionRepo as any,
    })
  })

  describe("Input Validation", () => {
    it("should fail with invalid subscriptionId (zero)", async () => {
      const result = await useCase.execute({ subscriptionId: 0 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("UPDATE_SUBSCRIPTION_VALIDATION_ERROR")
      }
    })

    it("should fail with negative subscriptionId", async () => {
      const result = await useCase.execute({ subscriptionId: -1 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("UPDATE_SUBSCRIPTION_VALIDATION_ERROR")
      }
    })
  })

  describe("Subscription Lookup", () => {
    it("should fail when subscription is not found", async () => {
      const result = await useCase.execute({ subscriptionId: 999 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("Subscription not found")
        expect(result.code).toBe("SUBSCRIPTION_NOT_FOUND")
      }
    })
  })

  describe("Successful Updates", () => {
    beforeEach(() => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "active",
        subscription_name: "Old Plan",
        amount: 25000,
        duration: "monthly",
      })
    })

    it("should return success with updated=true", async () => {
      const result = await useCase.execute({
        subscriptionId: 1,
        subscriptionName: "New Plan",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.subscriptionId).toBe(1)
        expect(result.data.updated).toBe(true)
      }
    })

    it("should update subscriptionName when provided", async () => {
      await useCase.execute({ subscriptionId: 1, subscriptionName: "Updated Plan" })

      const sub = await subscriptionRepo.findById(1)
      expect(sub?.subscription_name).toBe("Updated Plan")
    })

    it("should update amount when provided", async () => {
      await useCase.execute({ subscriptionId: 1, amount: 30000 })

      const sub = await subscriptionRepo.findById(1)
      expect(sub?.amount).toBe(30000)
    })

    it("should update duration when provided", async () => {
      await useCase.execute({ subscriptionId: 1, duration: "yearly" })

      const sub = await subscriptionRepo.findById(1)
      expect(sub?.duration).toBe("yearly")
    })

    it("should update status when provided", async () => {
      await useCase.execute({ subscriptionId: 1, status: "inactive" })

      const sub = await subscriptionRepo.findById(1)
      expect(sub?.status).toBe("inactive")
    })

    it("should only update provided fields (partial update)", async () => {
      await useCase.execute({ subscriptionId: 1, subscriptionName: "New Name" })

      const sub = await subscriptionRepo.findById(1)
      // Amount and duration should remain unchanged
      expect(sub?.amount).toBe(25000)
      expect(sub?.duration).toBe("monthly")
    })

    it("should update multiple fields at once", async () => {
      await useCase.execute({
        subscriptionId: 1,
        subscriptionName: "New Plan",
        amount: 35000,
        duration: "yearly",
      })

      const sub = await subscriptionRepo.findById(1)
      expect(sub?.subscription_name).toBe("New Plan")
      expect(sub?.amount).toBe(35000)
      expect(sub?.duration).toBe("yearly")
    })

    it("should log a transaction record", async () => {
      await useCase.execute({ subscriptionId: 1, subscriptionName: "Updated" })

      const txs = transactionRepo.getAll()
      expect(txs).toHaveLength(1)
      expect(txs[0].user_id).toBe(10)
      expect(txs[0].memo).toBe("Subscription updated")
      expect(txs[0].status).toBe("completed")
    })

    it("should succeed with no fields to update (just subscriptionId)", async () => {
      const result = await useCase.execute({ subscriptionId: 1 })
      // Still valid — updatedAt gets set
      expect(result.success).toBe(true)
    })
  })
})
