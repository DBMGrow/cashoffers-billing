import { describe, it, expect, beforeEach } from "vitest"
import { CreateFreeTrialUseCase } from "./create-free-trial.use-case"
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

  getAll() {
    return this.subscriptions
  }
}

class MockTransactionRepository {
  private transactions: any[] = []

  async create(data: any) {
    const tx = { transaction_id: this.transactions.length + 1, ...data }
    this.transactions.push(tx)
    return tx
  }
}

class MockProductRepository {
  private freeTrialProduct: any = null

  async findFreeTrialProduct() {
    return this.freeTrialProduct
  }

  setFreeTrialProduct(product: any) {
    this.freeTrialProduct = product
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

describe("CreateFreeTrialUseCase", () => {
  let useCase: CreateFreeTrialUseCase
  let subscriptionRepo: MockSubscriptionRepository
  let transactionRepo: MockTransactionRepository
  let productRepo: MockProductRepository
  let eventBus: MockEventBus

  const defaultProduct = {
    product_id: 99,
    product_name: "Free Trial",
    price: 0,
    data: JSON.stringify({
      homeuptick: {
        free_trial: {
          duration_days: 90,
        },
      },
    }),
  }

  beforeEach(() => {
    subscriptionRepo = new MockSubscriptionRepository()
    transactionRepo = new MockTransactionRepository()
    productRepo = new MockProductRepository()
    eventBus = new MockEventBus()

    useCase = new CreateFreeTrialUseCase({
      logger: new ConsoleLogger(),
      subscriptionRepository: subscriptionRepo as any,
      transactionRepository: transactionRepo as any,
      productRepository: productRepo as any,
      eventBus,
    })
  })

  describe("Blocking Conditions", () => {
    it("should fail when user already has an active subscription", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "active",
      })
      productRepo.setFreeTrialProduct(defaultProduct)

      const result = await useCase.execute({ userId: 10, email: "user@test.com" })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("TRIAL_ALREADY_EXISTS")
      }
    })

    it("should fail when user already has a trial subscription", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "trial",
      })
      productRepo.setFreeTrialProduct(defaultProduct)

      const result = await useCase.execute({ userId: 10, email: "user@test.com" })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("TRIAL_ALREADY_EXISTS")
      }
    })

    it("should fail when user already has a suspended subscription", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "suspended",
      })
      productRepo.setFreeTrialProduct(defaultProduct)

      const result = await useCase.execute({ userId: 10, email: "user@test.com" })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("TRIAL_ALREADY_EXISTS")
      }
    })

    it("should allow trial when user has only inactive subscriptions", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 10,
        status: "inactive",
      })
      productRepo.setFreeTrialProduct(defaultProduct)

      const result = await useCase.execute({ userId: 10, email: "user@test.com" })

      expect(result.success).toBe(true)
    })

    it("should fail when free trial product does not exist", async () => {
      productRepo.setFreeTrialProduct(null)

      const result = await useCase.execute({ userId: 10, email: "user@test.com" })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("PRODUCT_NOT_FOUND")
      }
    })
  })

  describe("Successful Trial Creation", () => {
    beforeEach(() => {
      productRepo.setFreeTrialProduct(defaultProduct)
    })

    it("should return success with subscriptionId", async () => {
      const result = await useCase.execute({ userId: 10, email: "user@test.com" })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.subscriptionId).toBeGreaterThan(0)
      }
    })

    it("should create subscription with trial status and zero amount", async () => {
      await useCase.execute({ userId: 10, email: "user@test.com" })

      const subs = subscriptionRepo.getAll()
      expect(subs).toHaveLength(1)
      expect(subs[0].status).toBe("trial")
      expect(subs[0].amount).toBe(0)
      expect(subs[0].user_id).toBe(10)
    })

    it("should set renewal_date to now + 90 days (from product config)", async () => {
      const before = new Date()
      await useCase.execute({ userId: 10, email: "user@test.com" })
      const after = new Date()

      const subs = subscriptionRepo.getAll()
      const renewalDate = new Date(subs[0].renewal_date)

      // Should be approximately 90 days from now
      const expectedMin = new Date(before)
      expectedMin.setDate(expectedMin.getDate() + 89)
      const expectedMax = new Date(after)
      expectedMax.setDate(expectedMax.getDate() + 91)

      expect(renewalDate.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime())
      expect(renewalDate.getTime()).toBeLessThanOrEqual(expectedMax.getTime())
    })

    it("should default to 90 days when product has no duration_days configured", async () => {
      productRepo.setFreeTrialProduct({
        ...defaultProduct,
        data: JSON.stringify({}), // No homeuptick config
      })

      const before = new Date()
      await useCase.execute({ userId: 10, email: "user@test.com" })

      const subs = subscriptionRepo.getAll()
      const renewalDate = new Date(subs[0].renewal_date)
      const expectedRenewal = new Date(before)
      expectedRenewal.setDate(expectedRenewal.getDate() + 90)

      const diffDays = Math.round(
        (renewalDate.getTime() - expectedRenewal.getTime()) / (1000 * 60 * 60 * 24)
      )
      expect(Math.abs(diffDays)).toBeLessThanOrEqual(1)
    })

    it("should publish SubscriptionCreatedEvent", async () => {
      await useCase.execute({ userId: 10, email: "user@test.com" })

      const events = eventBus.getPublishedEvents()
      const createdEvent = events.find((e) => e.eventType === "SubscriptionCreated")
      expect(createdEvent).toBeDefined()
      expect(createdEvent?.payload.userId).toBe(10)
      expect(createdEvent?.payload.email).toBe("user@test.com")
      expect(createdEvent?.payload.amount).toBe(0)
    })

    it("should associate subscription with the free trial product", async () => {
      await useCase.execute({ userId: 10, email: "user@test.com" })

      const subs = subscriptionRepo.getAll()
      expect(subs[0].product_id).toBe(99)
    })
  })
})
