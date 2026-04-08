import { describe, it, expect, beforeEach } from "vitest"
import { PauseSubscriptionUseCase } from "./pause-subscription.use-case"
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

class MockUserApiClient {
  private users = new Map<number, any>()

  async getUser(id: number) {
    return this.users.get(id) || null
  }

  addUser(id: number, data: any) {
    this.users.set(id, { user_id: id, ...data })
  }

  setNextRequestShouldFail(_: boolean) {}
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

  clearEvents() {
    this.events = []
  }
}

class MockEmailService {
  async sendEmail() {}
  async sendPlainEmail() {}
}

describe("PauseSubscriptionUseCase", () => {
  let useCase: PauseSubscriptionUseCase
  let subscriptionRepo: MockSubscriptionRepository
  let transactionRepo: MockTransactionRepository
  let userApiClient: MockUserApiClient
  let eventBus: MockEventBus

  beforeEach(() => {
    subscriptionRepo = new MockSubscriptionRepository()
    transactionRepo = new MockTransactionRepository()
    userApiClient = new MockUserApiClient()
    eventBus = new MockEventBus()

    useCase = new PauseSubscriptionUseCase({
      logger: new ConsoleLogger(),
      subscriptionRepository: subscriptionRepo as any,
      transactionRepository: transactionRepo as any,
      emailService: new MockEmailService() as any,
      userApiClient: userApiClient as any,
      eventBus,
    })
  })

  describe("Input Validation", () => {
    it("should fail with invalid subscriptionId (zero)", async () => {
      const result = await useCase.execute({ subscriptionId: 0 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("PAUSE_VALIDATION_ERROR")
      }
    })

    it("should fail with negative subscriptionId", async () => {
      const result = await useCase.execute({ subscriptionId: -1 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("PAUSE_VALIDATION_ERROR")
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
    it("should fail when subscription is already paused", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "paused",
      })

      const result = await useCase.execute({ subscriptionId: 1 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("INVALID_STATUS")
        expect(result.error).toContain("active subscriptions can be paused")
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

  describe("Successful Pause", () => {
    beforeEach(() => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "active",
        subscription_name: "Test Plan",
      })
      userApiClient.addUser(10, { email: "user@test.com" })
    })

    it("should return success with paused status", async () => {
      const result = await useCase.execute({ subscriptionId: 1 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.subscriptionId).toBe(1)
        expect(result.data.status).toBe("paused")
      }
    })

    it("should update subscription status to paused in database", async () => {
      await useCase.execute({ subscriptionId: 1 })

      const sub = await subscriptionRepo.findById(1)
      expect(sub?.status).toBe("paused")
    })

    it("should set suspension_date on the subscription", async () => {
      const before = new Date()
      await useCase.execute({ subscriptionId: 1 })
      const after = new Date()

      const sub = await subscriptionRepo.findById(1)
      expect(sub?.suspension_date).toBeInstanceOf(Date)
      expect(sub!.suspension_date.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(sub!.suspension_date.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it("should log a transaction record", async () => {
      await useCase.execute({ subscriptionId: 1 })

      const txs = transactionRepo.getAll()
      expect(txs).toHaveLength(1)
      expect(txs[0].user_id).toBe(10)
      expect(txs[0].memo).toBe("Subscription paused")
      expect(txs[0].status).toBe("completed")
    })

    it("should publish SubscriptionPausedEvent", async () => {
      await useCase.execute({ subscriptionId: 1 })

      const events = eventBus.getPublishedEvents()
      const pausedEvent = events.find((e) => e.eventType === "SubscriptionPaused")
      expect(pausedEvent).toBeDefined()
      expect(pausedEvent?.payload.subscriptionId).toBe(1)
      expect(pausedEvent?.payload.userId).toBe(10)
    })

    it("should include user email in the SubscriptionPausedEvent", async () => {
      await useCase.execute({ subscriptionId: 1 })

      const events = eventBus.getPublishedEvents()
      const pausedEvent = events.find((e) => e.eventType === "SubscriptionPaused")
      expect(pausedEvent?.payload.email).toBe("user@test.com")
    })

    it("should still succeed when user email lookup fails", async () => {
      // No user added to API client — getUser will return null
      const noEmailUseCase = new PauseSubscriptionUseCase({
        logger: new ConsoleLogger(),
        subscriptionRepository: subscriptionRepo as any,
        transactionRepository: transactionRepo as any,
        emailService: new MockEmailService() as any,
        userApiClient: { getUser: async () => { throw new Error("API down") } } as any,
        eventBus,
      })

      const result = await noEmailUseCase.execute({ subscriptionId: 1 })
      expect(result.success).toBe(true)
    })
  })
})
