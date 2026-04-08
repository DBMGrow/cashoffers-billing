import { describe, it, expect, beforeEach } from "vitest"
import { DeactivateSubscriptionUseCase } from "./deactivate-subscription.use-case"
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

class MockUserApiClient {
  private users = new Map<number, any>()

  async getUser(id: number) {
    return this.users.get(id) || null
  }

  addUser(id: number, data: any) {
    this.users.set(id, { user_id: id, ...data })
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

describe("DeactivateSubscriptionUseCase", () => {
  let useCase: DeactivateSubscriptionUseCase
  let subscriptionRepo: MockSubscriptionRepository
  let userApiClient: MockUserApiClient
  let eventBus: MockEventBus

  beforeEach(() => {
    subscriptionRepo = new MockSubscriptionRepository()
    userApiClient = new MockUserApiClient()
    eventBus = new MockEventBus()

    useCase = new DeactivateSubscriptionUseCase({
      logger: new ConsoleLogger(),
      subscriptionRepository: subscriptionRepo as any,
      userApiClient: userApiClient as any,
      eventBus,
    })
  })

  describe("Input Validation", () => {
    it("should fail with invalid userId (zero)", async () => {
      const result = await useCase.execute({ userId: 0 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("DEACTIVATE_SUBSCRIPTION_VALIDATION_ERROR")
      }
    })

    it("should fail with negative userId", async () => {
      const result = await useCase.execute({ userId: -1 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("DEACTIVATE_SUBSCRIPTION_VALIDATION_ERROR")
      }
    })
  })

  describe("Subscription Lookup", () => {
    it("should fail when no subscription found for user", async () => {
      const result = await useCase.execute({ userId: 999 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("No subscription found for user")
        expect(result.code).toBe("SUBSCRIPTION_NOT_FOUND")
      }
    })
  })

  describe("Successful Deactivation", () => {
    beforeEach(() => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "active",
        subscription_name: "Test Plan",
      })
      userApiClient.addUser(10, { email: "user@test.com" })
    })

    it("should return success with inactive status", async () => {
      const result = await useCase.execute({ userId: 10 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.userId).toBe(10)
        expect(result.data.status).toBe("inactive")
      }
    })

    it("should update subscription status to inactive in database", async () => {
      await useCase.execute({ userId: 10 })

      const sub = await subscriptionRepo.findById(1)
      expect(sub?.status).toBe("inactive")
    })

    it("should publish SubscriptionDeactivatedEvent", async () => {
      await useCase.execute({ userId: 10 })

      const events = eventBus.getPublishedEvents()
      const deactivatedEvent = events.find((e) => e.eventType === "SubscriptionDeactivated")
      expect(deactivatedEvent).toBeDefined()
      expect(deactivatedEvent?.payload.subscriptionId).toBe(1)
      expect(deactivatedEvent?.payload.userId).toBe(10)
    })

    it("should include user email in the SubscriptionDeactivatedEvent", async () => {
      await useCase.execute({ userId: 10 })

      const events = eventBus.getPublishedEvents()
      const deactivatedEvent = events.find((e) => e.eventType === "SubscriptionDeactivated")
      expect(deactivatedEvent?.payload.email).toBe("user@test.com")
    })

    it("should record the previous status in the event", async () => {
      await useCase.execute({ userId: 10 })

      const events = eventBus.getPublishedEvents()
      const deactivatedEvent = events.find((e) => e.eventType === "SubscriptionDeactivated")
      expect(deactivatedEvent?.payload.previousStatus).toBe("active")
    })

    it("should deactivate the first subscription when user has multiple", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 2,
        user_id: 10,
        status: "inactive",
        subscription_name: "Old Plan",
      })

      await useCase.execute({ userId: 10 })

      // First subscription (id=1) should be deactivated
      const sub1 = await subscriptionRepo.findById(1)
      expect(sub1?.status).toBe("inactive")
    })

    it("should still succeed when user email lookup fails", async () => {
      const failingClientUseCase = new DeactivateSubscriptionUseCase({
        logger: new ConsoleLogger(),
        subscriptionRepository: subscriptionRepo as any,
        userApiClient: { getUser: async () => { throw new Error("API down") } } as any,
        eventBus,
      })

      const result = await failingClientUseCase.execute({ userId: 10 })
      expect(result.success).toBe(true)
    })
  })
})
