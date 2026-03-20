import { describe, it, expect, beforeEach } from "vitest"
import { ResumeSubscriptionUseCase } from "./resume-subscription.use-case"
import { ConsoleLogger } from "@api/infrastructure/logging/console.logger"
import { IEventBus, IDomainEvent } from "@api/infrastructure/events/event-bus.interface"

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

class MockEventBus implements IEventBus {
  private events: IDomainEvent[] = []

  async publish(event: IDomainEvent) {
    this.events.push(event)
  }

  async publishBatch(events: IDomainEvent[]) {
    this.events.push(...events)
  }

  subscribe() {}
  unsubscribe() {}

  getPublishedEvents() {
    return this.events
  }
}

describe("ResumeSubscriptionUseCase", () => {
  let useCase: ResumeSubscriptionUseCase
  let subscriptionRepo: MockSubscriptionRepository
  let transactionRepo: MockTransactionRepository
  let eventBus: MockEventBus

  beforeEach(() => {
    subscriptionRepo = new MockSubscriptionRepository()
    transactionRepo = new MockTransactionRepository()
    eventBus = new MockEventBus()

    useCase = new ResumeSubscriptionUseCase({
      logger: new ConsoleLogger(),
      subscriptionRepository: subscriptionRepo as any,
      transactionRepository: transactionRepo as any,
      eventBus,
    })
  })

  describe("Input Validation", () => {
    it("should fail with invalid subscriptionId (zero)", async () => {
      const result = await useCase.execute({ subscriptionId: 0 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("RESUME_VALIDATION_ERROR")
      }
    })

    it("should fail with negative subscriptionId", async () => {
      const result = await useCase.execute({ subscriptionId: -5 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("RESUME_VALIDATION_ERROR")
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

  describe("Status Validation", () => {
    it("should fail when subscription is already active", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "active",
      })

      const result = await useCase.execute({ subscriptionId: 1 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("INVALID_STATUS")
        expect(result.error).toContain("suspended subscriptions can be resumed")
      }
    })

    it("should fail when subscription is inactive", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "inactive",
      })

      const result = await useCase.execute({ subscriptionId: 1 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("INVALID_STATUS")
      }
    })
  })

  describe("Successful Resume", () => {
    it("should return success with active status", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "suspended",
      })

      const result = await useCase.execute({ subscriptionId: 1 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.subscriptionId).toBe(1)
        expect(result.data.status).toBe("active")
      }
    })

    it("should update subscription status to active in database", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "suspended",
      })

      await useCase.execute({ subscriptionId: 1 })

      const sub = await subscriptionRepo.findById(1)
      expect(sub?.status).toBe("active")
    })

    it("should clear the suspension_date", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "suspended",
        suspension_date: new Date("2026-01-01"),
      })

      await useCase.execute({ subscriptionId: 1 })

      const sub = await subscriptionRepo.findById(1)
      expect(sub?.suspension_date).toBeNull()
    })

    it("should log a transaction record", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "suspended",
      })

      await useCase.execute({ subscriptionId: 1 })

      const txs = transactionRepo.getAll()
      expect(txs).toHaveLength(1)
      expect(txs[0].user_id).toBe(10)
      expect(txs[0].memo).toBe("Subscription resumed")
      expect(txs[0].status).toBe("completed")
    })

    it("should publish SubscriptionResumedEvent", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "suspended",
      })

      await useCase.execute({ subscriptionId: 1 })

      const events = eventBus.getPublishedEvents()
      const resumedEvent = events.find((e) => e.eventType === "SubscriptionResumed")
      expect(resumedEvent).toBeDefined()
      expect(resumedEvent?.payload.subscriptionId).toBe(1)
      expect(resumedEvent?.payload.userId).toBe(10)
    })
  })

  describe("Renewal Date Calculation", () => {
    it("should adjust renewal date based on time paused when suspension_date is set", async () => {
      // Paused on Mar 15 with renewal on Mar 30 (15 days remaining)
      // Resumed on May 16 => new renewal should be May 16 + 15 = May 31
      const suspensionDate = new Date("2026-03-15")
      const originalRenewalDate = new Date("2026-03-30")

      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "suspended",
        suspension_date: suspensionDate,
        renewal_date: originalRenewalDate,
      })

      const resumeDate = new Date("2026-05-16")

      // Mock "now" by controlling the time in the test
      const realDateNow = Date.now
      const mockNow = resumeDate.getTime()
      Date.now = () => mockNow
      const OriginalDate = globalThis.Date
      const MockDate = class extends OriginalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(mockNow)
          } else {
            // @ts-ignore
            super(...args)
          }
        }
      } as any
      MockDate.now = () => mockNow
      globalThis.Date = MockDate

      try {
        await useCase.execute({ subscriptionId: 1 })

        const sub = await subscriptionRepo.findById(1)
        // 15 days remaining at pause, resumed May 16 => new renewal ~May 31
        const newRenewal = new Date(sub!.renewal_date)
        const expectedRenewal = new Date("2026-05-31")
        const diffDays = Math.round(
          (newRenewal.getTime() - expectedRenewal.getTime()) / (1000 * 60 * 60 * 24)
        )
        expect(Math.abs(diffDays)).toBeLessThanOrEqual(1)
      } finally {
        globalThis.Date = OriginalDate
        Date.now = realDateNow
      }
    })

    it("should not set a new renewal date if suspension_date is missing", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "suspended",
        suspension_date: null,
        renewal_date: new Date("2026-03-30"),
      })

      await useCase.execute({ subscriptionId: 1 })

      const sub = await subscriptionRepo.findById(1)
      // renewal_date should not be updated (it stays as the original)
      // The key thing is renewal_date key is not present in updateData when no suspension_date
      // The subscription stays with its original renewal_date
      const originalRenewal = new Date("2026-03-30")
      expect(new Date(sub!.renewal_date).getTime()).toBe(originalRenewal.getTime())
    })

    it("should include newRenewalDate in SubscriptionResumedEvent when suspension_date is set", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "suspended",
        suspension_date: new Date("2026-03-15"),
        renewal_date: new Date("2026-03-30"),
      })

      await useCase.execute({ subscriptionId: 1 })

      const events = eventBus.getPublishedEvents()
      const resumedEvent = events.find((e) => e.eventType === "SubscriptionResumed")
      expect(resumedEvent?.payload.newRenewalDate).toBeInstanceOf(Date)
    })
  })
})
