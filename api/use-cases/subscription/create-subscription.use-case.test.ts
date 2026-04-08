import { describe, it, expect, beforeEach } from "vitest"
import { CreateSubscriptionUseCase } from "./create-subscription.use-case"
import { ConsoleLogger } from "@api/infrastructure/logging/console.logger"
import { MockPaymentProvider } from "@api/infrastructure/payment/mock/mock-payment.provider"
import { MockEmailService } from "@api/infrastructure/email/mock/mock-email.service"
import { MockUserApiClient } from "@api/infrastructure/external-api/user-api/mock-user-api.client"
import { IEventBus, IDomainEvent } from "@api/infrastructure/events/event-bus.interface"

// Mock repositories (simplified for testing)
class MockSubscriptionRepository {
  private subscriptions: any[] = []

  async findById(id: number) {
    return this.subscriptions.find((s) => s.subscription_id === id) || null
  }

  async findByUserId(userId: number) {
    return this.subscriptions.filter((s) => s.user_id === userId)
  }

  async create(data: any) {
    const subscription = {
      subscription_id: this.subscriptions.length + 1,
      ...data,
    }
    this.subscriptions.push(subscription)
    return subscription
  }

  async update(id: number, data: any) {
    const index = this.subscriptions.findIndex((s) => s.subscription_id === id)
    if (index === -1) return null
    this.subscriptions[index] = { ...this.subscriptions[index], ...data }
    return this.subscriptions[index]
  }

  async delete(id: number | bigint): Promise<void> {
    const numId = typeof id === "bigint" ? Number(id) : id
    const index = this.subscriptions.findIndex((s) => s.subscription_id === numId)
    if (index !== -1) {
      this.subscriptions.splice(index, 1)
    }
  }

  getAll() {
    return this.subscriptions
  }
}

class MockProductRepository {
  private products = new Map<string, any>()

  async findById(id: string | number) {
    return this.products.get(String(id)) || null
  }

  async findAll() {
    return Array.from(this.products.values())
  }

  async findOne(criteria: any) {
    return Array.from(this.products.values()).find((p) => {
      return Object.entries(criteria).every(([key, value]) => p[key] === value)
    }) || null
  }

  async create(data: any) {
    const product = { product_id: Date.now().toString(), ...data }
    this.products.set(product.product_id, product)
    return product
  }

  async update(id: number | bigint, data: any) {
    const numId = typeof id === "bigint" ? Number(id) : id
    const existing = await this.findById(numId)
    if (!existing) return null
    const updated = { ...existing, ...data }
    this.products.set(String(numId), updated)
    return updated
  }

  async delete(id: number | bigint): Promise<void> {
    this.products.delete(String(id))
  }

  // Test helper
  addProduct(id: string, productData: any) {
    this.products.set(id, { product_id: id, ...productData })
  }
}

class MockTransactionRepository {
  private transactions: any[] = []

  async findById(id: number) {
    return this.transactions.find((t) => t.transaction_id === id) || null
  }

  async findByUserId(userId: number) {
    return this.transactions.filter((t) => t.user_id === userId)
  }

  async create(data: any) {
    const transaction = {
      transaction_id: this.transactions.length + 1,
      ...data,
    }
    this.transactions.push(transaction)
    return transaction
  }

  async update(id: number, data: any) {
    const index = this.transactions.findIndex((t) => t.transaction_id === id)
    if (index === -1) return null
    this.transactions[index] = { ...this.transactions[index], ...data }
    return this.transactions[index]
  }

  async delete(id: number | bigint): Promise<void> {
    const numId = typeof id === "bigint" ? Number(id) : id
    const index = this.transactions.findIndex((t) => t.transaction_id === numId)
    if (index !== -1) {
      this.transactions.splice(index, 1)
    }
  }

  getAll() {
    return this.transactions
  }
}

class MockUserCardRepository {
  private cards = new Map<number, any>()

  async findByUserId(userId: number) {
    const card = this.cards.get(userId)
    return card ? [card] : []
  }

  async findById(id: number) {
    for (const card of this.cards.values()) {
      if (card.id === id) return card
    }
    return null
  }

  async create(data: any) {
    const card = { id: Date.now(), ...data }
    this.cards.set(data.user_id, card)
    return card
  }

  async update(id: number, data: any) {
    const existing = await this.findById(id)
    if (!existing) return null
    const updated = { ...existing, ...data }
    this.cards.set(updated.user_id, updated)
    return updated
  }

  async delete(id: number | bigint): Promise<void> {
    const numId = typeof id === "bigint" ? Number(id) : id
    for (const [userId, card] of this.cards.entries()) {
      if (card.id === numId) {
        this.cards.delete(userId)
        return
      }
    }
  }

  // Test helper
  addCard(userId: number, cardData: any) {
    this.cards.set(userId, {
      id: Date.now(),
      user_id: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...cardData,
    })
  }
}

class MockEventBus implements IEventBus {
  private events: IDomainEvent[] = []

  async publish(event: IDomainEvent): Promise<void> {
    this.events.push(event)
  }

  async publishBatch(events: IDomainEvent[]): Promise<void> {
    this.events.push(...events)
  }

  subscribe(): void {
    // No-op for tests
  }

  unsubscribe(): void {
    // No-op for tests
  }

  // Test helper
  getPublishedEvents() {
    return this.events
  }

  clearEvents() {
    this.events = []
  }
}

describe("CreateSubscriptionUseCase", () => {
  let useCase: CreateSubscriptionUseCase
  let logger: ConsoleLogger
  let paymentProvider: MockPaymentProvider
  let emailService: MockEmailService
  let userApiClient: MockUserApiClient
  let subscriptionRepo: MockSubscriptionRepository
  let productRepo: MockProductRepository
  let transactionRepo: MockTransactionRepository
  let userCardRepo: MockUserCardRepository
  let eventBus: MockEventBus

  beforeEach(() => {
    logger = new ConsoleLogger()
    paymentProvider = new MockPaymentProvider()
    emailService = new MockEmailService()
    userApiClient = new MockUserApiClient()
    subscriptionRepo = new MockSubscriptionRepository()
    productRepo = new MockProductRepository()
    transactionRepo = new MockTransactionRepository()
    userCardRepo = new MockUserCardRepository()
    eventBus = new MockEventBus()

    useCase = new CreateSubscriptionUseCase({
      logger,
      paymentProvider,
      emailService,
      userApiClient,
      subscriptionRepository: subscriptionRepo as any,
      productRepository: productRepo as any,
      transactionRepository: transactionRepo as any,
      userCardRepository: userCardRepo as any,
      eventBus,
    })
  })

  describe("Product Validation", () => {
    it("should fail if product not found", async () => {
      const result = await useCase.execute({
        userId: 1,
        productId: "nonexistent",
        email: "user@test.com",
        userAlreadyExists: false,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("Product not found")
        expect(result.code).toBe("PRODUCT_NOT_FOUND")
      }
    })

    it("should fail if product data is invalid", async () => {
      productRepo.addProduct("prod_1", {
        product_name: "Test Product",
        price: 25000,
        data: JSON.stringify({ renewal_cost: 25000 }), // Missing duration
      })

      const result = await useCase.execute({
        userId: 1,
        productId: "prod_1",
        email: "user@test.com",
        userAlreadyExists: false,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain("duration")
        expect(result.code).toBe("INVALID_PRODUCT_CONFIG")
      }
    })
  })

  describe("User Activation", () => {
    beforeEach(() => {
      productRepo.addProduct("prod_1", {
        product_name: "CashOffers.PRO",
        price: 10000,
        data: JSON.stringify({ duration: "monthly", renewal_cost: 25000 }),
      })

      // Add user card for payment
      userCardRepo.addCard(1, {
        card_id: "card_123",
        square_customer_id: "cust_123",
        last_4: "4242",
        card_brand: "VISA",
        exp_month: "12",
        exp_year: "2025",
        cardholder_first_name: "Test", last_name: "User",
      })

      paymentProvider.addTestCard({
        id: "card_123",
        customerId: "cust_123",
        last4: "4242",
        cardBrand: "VISA",
        expMonth: 12,
        expYear: 2025,
      })

      // Add user to API client
      userApiClient.addMockUser({
        id: 1,
        email: "user@test.com",
        first_name: "Test",
        last_name: "User",
        active: false,
        is_premium: false,
      })
    })

    it("should activate user when creating subscription", async () => {
      const result = await useCase.execute({
        userId: 1,
        productId: "prod_1",
        email: "user@test.com",
        userAlreadyExists: false,
      })

      expect(result.success).toBe(true)

      const user = await userApiClient.getUser(1)
      expect(user?.active).toBe(true)
      expect(user?.is_premium).toBe(true)
    })

    it("should fail if user activation fails", async () => {
      // Simulate API failure
      userApiClient.setNextRequestShouldFail(true)

      const result = await useCase.execute({
        userId: 1,
        productId: "prod_1",
        email: "user@test.com",
        userAlreadyExists: false,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("Failed to activate user")
        expect(result.code).toBe("USER_ACTIVATION_FAILED")
      }
    })
  })

  describe("Subscription Creation", () => {
    beforeEach(() => {
      productRepo.addProduct("prod_1", {
        product_name: "CashOffers.PRO",
        price: 10000,
        data: JSON.stringify({ duration: "monthly", renewal_cost: 25000 }),
      })

      userCardRepo.addCard(1, {
        card_id: "card_123",
        square_customer_id: "cust_123",
        last_4: "4242",
        card_brand: "VISA",
        exp_month: "12",
        exp_year: "2025",
        cardholder_first_name: "Test", last_name: "User",
      })

      paymentProvider.addTestCard({
        id: "card_123",
        customerId: "cust_123",
        last4: "4242",
        cardBrand: "VISA",
        expMonth: 12,
        expYear: 2025,
      })

      userApiClient.addMockUser({
        id: 1,
        email: "user@test.com",
        first_name: "Test", last_name: "User",
        active: false,
        is_premium: false,
      })
    })

    it("should create subscription successfully", async () => {
      const result = await useCase.execute({
        userId: 1,
        productId: "prod_1",
        email: "user@test.com",
        userAlreadyExists: false,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.subscriptionId).toBe(1)
        expect(result.data.status).toBe("active")
        expect(result.data.amount).toBe(25000)
        expect(result.data.renewalDate).toBeInstanceOf(Date)
      }
    })

    it("should save subscription to database", async () => {
      await useCase.execute({
        userId: 1,
        productId: "prod_1",
        email: "user@test.com",
        userAlreadyExists: false,
      })

      const subscriptions = subscriptionRepo.getAll()
      expect(subscriptions).toHaveLength(1)
      expect(subscriptions[0].user_id).toBe(1)
      // productId is converted to number even if input as string
      expect(subscriptions[0].product_id).toBeTypeOf("number")
      expect(subscriptions[0].amount).toBe(25000)
      expect(subscriptions[0].status).toBe("active")
    })

    it("should calculate monthly renewal date correctly", async () => {
      const result = await useCase.execute({
        userId: 1,
        productId: "prod_1",
        email: "user@test.com",
        userAlreadyExists: false,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        const renewalDate = result.data.renewalDate
        const now = new Date()
        const expectedDate = new Date(now.setMonth(now.getMonth() + 1))

        // Check if renewal date is approximately 1 month from now (within 1 day)
        const diff = Math.abs(renewalDate.getTime() - expectedDate.getTime())
        expect(diff).toBeLessThan(24 * 60 * 60 * 1000) // Less than 1 day difference
      }
    })
  })

  describe("Initial Payment", () => {
    beforeEach(() => {
      productRepo.addProduct("prod_1", {
        product_name: "CashOffers.PRO",
        price: 10000,
        data: JSON.stringify({ duration: "monthly", renewal_cost: 25000 }),
      })

      userCardRepo.addCard(1, {
        card_id: "card_123",
        square_customer_id: "cust_123",
        last_4: "4242",
        card_brand: "VISA",
        exp_month: "12",
        exp_year: "2025",
        cardholder_first_name: "Test", last_name: "User",
      })

      paymentProvider.addTestCard({
        id: "card_123",
        customerId: "cust_123",
        last4: "4242",
        cardBrand: "VISA",
        expMonth: 12,
        expYear: 2025,
      })

      userApiClient.addMockUser({
        id: 1,
        email: "user@test.com",
        first_name: "Test", last_name: "User",
        active: false,
        is_premium: false,
      })
    })

    it("should charge signup fee for new users", async () => {
      await useCase.execute({
        userId: 1,
        productId: "prod_1",
        email: "user@test.com",
        userAlreadyExists: false,
        waiveSignupFee: false,
      })

      const payments = paymentProvider.getPayments()
      expect(payments).toHaveLength(1)
      // Should be renewal_cost (25000) + signup fee (10000) = 35000
      expect(payments[0].amountMoney.amount).toBe(BigInt(35000))
    })

    it("should not charge signup fee for existing users", async () => {
      await useCase.execute({
        userId: 1,
        productId: "prod_1",
        email: "user@test.com",
        userAlreadyExists: true,
      })

      const payments = paymentProvider.getPayments()
      expect(payments).toHaveLength(1)
      // Should be renewal_cost only (25000)
      expect(payments[0].amountMoney.amount).toBe(BigInt(25000))
    })

    it("should waive signup fee when requested", async () => {
      await useCase.execute({
        userId: 1,
        productId: "prod_1",
        email: "user@test.com",
        userAlreadyExists: false,
        waiveSignupFee: true,
      })

      const payments = paymentProvider.getPayments()
      expect(payments).toHaveLength(1)
      // Should be renewal_cost only (25000)
      expect(payments[0].amountMoney.amount).toBe(BigInt(25000))
    })

    it("should log payment transaction", async () => {
      await useCase.execute({
        userId: 1,
        productId: "prod_1",
        email: "user@test.com",
        userAlreadyExists: false,
      })

      const transactions = transactionRepo.getAll()
      // Should have 2 transactions: payment + subscription creation
      expect(transactions.length).toBeGreaterThanOrEqual(2)

      const paymentTx = transactions.find((t) => t.type === "payment")
      expect(paymentTx).toBeDefined()
      expect(paymentTx?.user_id).toBe(1)
      expect(paymentTx?.status).toBe("completed")
    })
  })

  describe("Email Notification", () => {
    beforeEach(() => {
      productRepo.addProduct("prod_1", {
        product_name: "CashOffers.PRO",
        price: 10000,
        data: JSON.stringify({ duration: "monthly", renewal_cost: 25000 }),
      })

      userCardRepo.addCard(1, {
        card_id: "card_123",
        square_customer_id: "cust_123",
        last_4: "4242",
        card_brand: "VISA",
        exp_month: "12",
        exp_year: "2025",
        cardholder_first_name: "Test", last_name: "User",
      })

      paymentProvider.addTestCard({
        id: "card_123",
        customerId: "cust_123",
        last4: "4242",
        cardBrand: "VISA",
        expMonth: 12,
        expYear: 2025,
      })

      userApiClient.addMockUser({
        id: 1,
        email: "user@test.com",
        first_name: "Test", last_name: "User",
        active: false,
        is_premium: false,
      })
    })

    it("should publish SubscriptionCreated event (triggers subscription+payment email)", async () => {
      await useCase.execute({
        userId: 1,
        productId: "prod_1",
        email: "user@test.com",
        userAlreadyExists: false,
      })

      const events = eventBus.getPublishedEvents()
      const subscriptionCreated = events.find((e) => e.eventType === "SubscriptionCreated")
      expect(subscriptionCreated).toBeDefined()
      expect(subscriptionCreated?.payload.email).toBe("user@test.com")
    })

    it("should include externalTransactionId in SubscriptionCreated event", async () => {
      await useCase.execute({
        userId: 1,
        productId: "prod_1",
        email: "user@test.com",
        userAlreadyExists: false,
      })

      const events = eventBus.getPublishedEvents()
      const subscriptionCreated = events.find((e) => e.eventType === "SubscriptionCreated")
      expect(subscriptionCreated?.payload.externalTransactionId).toBeTruthy()
    })

    it("should include signup fee line item in SubscriptionCreated event", async () => {
      await useCase.execute({
        userId: 1,
        productId: "prod_1",
        email: "user@test.com",
        userAlreadyExists: false,
      })

      const events = eventBus.getPublishedEvents()
      const subscriptionCreated = events.find((e) => e.eventType === "SubscriptionCreated")
      const lineItems: Array<{ description: string }> = subscriptionCreated?.payload.lineItems ?? []
      expect(lineItems.some((item) => item.description === "Signup Fee")).toBe(true)
    })

    it("should not publish a separate one-time PaymentProcessed event for subscription creation", async () => {
      await useCase.execute({
        userId: 1,
        productId: "prod_1",
        email: "user@test.com",
        userAlreadyExists: false,
      })

      const events = eventBus.getPublishedEvents()
      const oneTimePayment = events.find(
        (e) => e.eventType === "PaymentProcessed" && e.payload.paymentType === "one-time"
      )
      expect(oneTimePayment).toBeUndefined()
    })
  })
})
