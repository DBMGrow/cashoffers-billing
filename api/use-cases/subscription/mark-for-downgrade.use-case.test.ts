import { describe, it, expect, beforeEach } from "vitest"
import { MarkForDowngradeUseCase } from "./mark-for-downgrade.use-case"
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

class MockEmailService {
  async sendEmail() {}
  async sendPlainEmail() {}
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

describe("MarkForDowngradeUseCase", () => {
  let useCase: MarkForDowngradeUseCase
  let subscriptionRepo: MockSubscriptionRepository
  let userApiClient: MockUserApiClient
  let eventBus: MockEventBus

  beforeEach(() => {
    subscriptionRepo = new MockSubscriptionRepository()
    userApiClient = new MockUserApiClient()
    eventBus = new MockEventBus()

    useCase = new MarkForDowngradeUseCase({
      logger: new ConsoleLogger(),
      subscriptionRepository: subscriptionRepo as any,
      emailService: new MockEmailService() as any,
      userApiClient: userApiClient as any,
      eventBus,
    })
  })

  describe("Input Validation", () => {
    it("should fail with invalid subscriptionId (zero)", async () => {
      const result = await useCase.execute({ subscriptionId: 0, downgrade: true })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("MARK_FOR_DOWNGRADE_VALIDATION_ERROR")
      }
    })

    it("should fail with negative subscriptionId", async () => {
      const result = await useCase.execute({ subscriptionId: -1, downgrade: true })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("MARK_FOR_DOWNGRADE_VALIDATION_ERROR")
      }
    })
  })

  describe("Subscription Lookup", () => {
    it("should fail when subscription is not found", async () => {
      const result = await useCase.execute({ subscriptionId: 999, downgrade: true })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("Subscription not found")
        expect(result.code).toBe("SUBSCRIPTION_NOT_FOUND")
      }
    })
  })

  describe("Mark for Downgrade (downgrade: true)", () => {
    beforeEach(() => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "active",
        subscription_name: "Premium Plan",
        downgrade_on_renewal: 0,
        renewal_date: new Date("2026-04-01"),
      })
      userApiClient.addUser(10, { email: "user@test.com" })
    })

    it("should return success with downgradeOnRenewal=true", async () => {
      const result = await useCase.execute({ subscriptionId: 1, downgrade: true })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.subscriptionId).toBe(1)
        expect(result.data.downgradeOnRenewal).toBe(true)
      }
    })

    it("should update downgrade_on_renewal to 1 in database", async () => {
      await useCase.execute({ subscriptionId: 1, downgrade: true })

      const sub = await subscriptionRepo.findById(1)
      expect(sub?.downgrade_on_renewal).toBe(1)
    })

    it("should publish SubscriptionDowngradedEvent when marking for downgrade", async () => {
      await useCase.execute({ subscriptionId: 1, downgrade: true })

      const events = eventBus.getPublishedEvents()
      const downgradedEvent = events.find((e) => e.eventType === "SubscriptionDowngraded")
      expect(downgradedEvent).toBeDefined()
      expect(downgradedEvent?.payload.subscriptionId).toBe(1)
      expect(downgradedEvent?.payload.userId).toBe(10)
      expect(downgradedEvent?.payload.downgradeOnRenewal).toBe(true)
    })

    it("should include user email in SubscriptionDowngradedEvent", async () => {
      await useCase.execute({ subscriptionId: 1, downgrade: true })

      const events = eventBus.getPublishedEvents()
      const downgradedEvent = events.find((e) => e.eventType === "SubscriptionDowngraded")
      expect(downgradedEvent?.payload.email).toBe("user@test.com")
    })

    it("should include effectiveDate (renewal_date) in event", async () => {
      await useCase.execute({ subscriptionId: 1, downgrade: true })

      const events = eventBus.getPublishedEvents()
      const downgradedEvent = events.find((e) => e.eventType === "SubscriptionDowngraded")
      expect(downgradedEvent?.payload.effectiveDate).toBeInstanceOf(Date)
    })
  })

  describe("Unmark Downgrade (downgrade: false)", () => {
    beforeEach(() => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "active",
        downgrade_on_renewal: 1,
        renewal_date: new Date("2026-04-01"),
      })
    })

    it("should return success with downgradeOnRenewal=false", async () => {
      const result = await useCase.execute({ subscriptionId: 1, downgrade: false })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.downgradeOnRenewal).toBe(false)
      }
    })

    it("should update downgrade_on_renewal to 0 in database", async () => {
      await useCase.execute({ subscriptionId: 1, downgrade: false })

      const sub = await subscriptionRepo.findById(1)
      expect(sub?.downgrade_on_renewal).toBe(0)
    })

    it("should NOT publish SubscriptionDowngradedEvent when unmarking", async () => {
      await useCase.execute({ subscriptionId: 1, downgrade: false })

      const events = eventBus.getPublishedEvents()
      const downgradedEvent = events.find((e) => e.eventType === "SubscriptionDowngraded")
      expect(downgradedEvent).toBeUndefined()
    })
  })
})
