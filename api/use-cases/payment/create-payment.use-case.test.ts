import { describe, it, expect, beforeEach } from "vitest"
import { CreatePaymentUseCase } from "./create-payment.use-case"
import { ConsoleLogger } from "@api/infrastructure/logging/console.logger"
import { MockPaymentProvider } from "@api/infrastructure/payment/mock/mock-payment.provider"
import { MockEmailService } from "@api/infrastructure/email/mock/mock-email.service"
import type { UserCardRepository } from "@api/lib/repositories"
import type { TransactionRepository } from "@api/lib/repositories"
import { IConfigService } from "@api/config/config.interface"
import { IEventBus, IDomainEvent } from "@api/infrastructure/events/event-bus.interface"

// Mock repositories (partial implementation for testing)
class MockUserCardRepository {
  private cards = new Map<number, any>()

  async findByUserId(userId: number) {
    const card = this.cards.get(userId)
    return card ? [card] : []
  }

  async findById(id: number) {
    for (const card of this.cards.values()) {
      if (card.userCardId === id) return card
    }
    return null
  }

  async create(data: any) {
    const card = { userCardId: Date.now(), ...data }
    this.cards.set(data.userId, card)
    return card
  }

  async update(id: number, data: any) {
    const existing = await this.findById(id)
    if (!existing) return null
    const updated = { ...existing, ...data, updatedAt: new Date() }
    this.cards.set(updated.userId, updated)
    return updated
  }

  async delete(id: number | bigint): Promise<void> {
    const numId = typeof id === "bigint" ? Number(id) : id
    for (const [userId, card] of this.cards.entries()) {
      if (card.userCardId === numId) {
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
      ...cardData
    })
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

  async findBySubscriptionId(subscriptionId: number) {
    return this.transactions.filter((t) => t.memo?.includes(`subscription_${subscriptionId}`))
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
    const index = this.transactions.findIndex((t) => t.transactionId === id)
    if (index === -1) return null
    this.transactions[index] = { ...this.transactions[index], ...data, updatedAt: new Date() }
    return this.transactions[index]
  }

  async delete(id: number | bigint): Promise<void> {
    const numId = typeof id === "bigint" ? Number(id) : id
    const index = this.transactions.findIndex((t) => t.transaction_id === numId)
    if (index !== -1) {
      this.transactions.splice(index, 1)
    }
  }

  // Test helper
  getAll() {
    return this.transactions
  }
}

class MockConfigService {
  private config = new Map<string, string>([
    ["ADMIN_EMAIL", "admin@test.com"],
    ["SQUARE_ENVIRONMENT", "sandbox"],
  ])

  get(key: string): string {
    return this.config.get(key) || ""
  }

  getOrThrow(key: string): string {
    const value = this.config.get(key)
    if (!value) throw new Error(`Config key ${key} not found`)
    return value
  }

  getAll() {
    return Object.fromEntries(this.config)
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

describe("CreatePaymentUseCase", () => {
  let useCase: CreatePaymentUseCase
  let logger: ConsoleLogger
  let paymentProvider: MockPaymentProvider
  let emailService: MockEmailService
  let userCardRepo: MockUserCardRepository
  let transactionRepo: MockTransactionRepository
  let config: MockConfigService
  let eventBus: MockEventBus

  beforeEach(() => {
    logger = new ConsoleLogger()
    paymentProvider = new MockPaymentProvider()
    emailService = new MockEmailService()
    userCardRepo = new MockUserCardRepository()
    transactionRepo = new MockTransactionRepository()
    config = new MockConfigService()
    eventBus = new MockEventBus()

    useCase = new CreatePaymentUseCase({
      logger,
      paymentProvider,
      emailService,
      userCardRepository: userCardRepo as any, // Partial mock for testing
      transactionRepository: transactionRepo as any, // Partial mock for testing
      config: config as any, // Mock config service
      eventBus,
    })
  })

  describe("Input Validation", () => {
    it("should fail if amount is missing", async () => {
      const result = await useCase.execute({
        userId: 1,
        amount: 0,
        email: "user@test.com",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain("at least 1 cent")
        expect(result.code).toBe("PAYMENT_VALIDATION_ERROR")
      }
    })

    it("should fail if amount is not a number", async () => {
      const result = await useCase.execute({
        userId: 1,
        amount: NaN,
        email: "user@test.com",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain("number")
      }
    })

    it("should fail if amount is less than 1 cent", async () => {
      const result = await useCase.execute({
        userId: 1,
        amount: 0,
        email: "user@test.com",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain("at least 1 cent")
      }
    })

    it("should fail if userId is missing", async () => {
      const result = await useCase.execute({
        userId: 0,
        amount: 5000,
        email: "user@test.com",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain("positive integer")
      }
    })

    it("should fail if email is missing", async () => {
      const result = await useCase.execute({
        userId: 1,
        amount: 5000,
        email: "",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain("email")
      }
    })
  })

  describe("Card Lookup", () => {
    it("should fail if no card found for user", async () => {
      const result = await useCase.execute({
        userId: 999,
        amount: 5000,
        email: "user@test.com",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("No card found")
        expect(result.code).toBe("NO_CARD_FOUND")
      }
    })

    it("should fail if card data is incomplete", async () => {
      userCardRepo.addCard(1, {
        card_id: null,
        square_customer_id: "cust_123",
        last_4: "4242",
        card_brand: "VISA",
        exp_month: "12",
        exp_year: "2025",
        cardholder_name: "Test User",
      })

      const result = await useCase.execute({
        userId: 1,
        amount: 5000,
        email: "user@test.com",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("Card information incomplete")
        expect(result.code).toBe("INCOMPLETE_CARD_DATA")
      }
    })
  })

  describe("Successful Payment", () => {
    beforeEach(() => {
      // Set up a valid card
      userCardRepo.addCard(1, {
        card_id: "card_123",
        square_customer_id: "cust_123",
        last_4: "4242",
        card_brand: "VISA",
        exp_month: "12",
        exp_year: "2025",
        cardholder_name: "Test User",
      })

      // Add card to payment provider
      paymentProvider.addTestCard({
        id: "card_123",
        customerId: "cust_123",
        last4: "4242",
        cardBrand: "VISA",
        expMonth: 12,
        expYear: 2025,
      })
    })

    it("should process payment successfully", async () => {
      const result = await useCase.execute({
        userId: 1,
        amount: 5000,
        email: "user@test.com",
        memo: "Test payment",
      })

      if (!result.success) {
        console.log("Payment failed:", result.error, result.code)
      }

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.amount).toBe(5000)
        expect(result.data.status).toBe("completed")
        expect(result.data.squarePaymentId).toBeTruthy()
        expect(result.data.transactionId).toBeTruthy()
      }
    })

    it("should log transaction to database", async () => {
      await useCase.execute({
        userId: 1,
        amount: 5000,
        email: "user@test.com",
        memo: "Test payment",
      })

      const transactions = transactionRepo.getAll()
      expect(transactions).toHaveLength(1)
      expect(transactions[0].user_id).toBe(1)
      expect(transactions[0].amount).toBe(5000)
      expect(transactions[0].type).toBe("payment")
      expect(transactions[0].status).toBe("completed")
      expect(transactions[0].memo).toBe("Test payment")
    })

    it("should send success email by default", async () => {
      await useCase.execute({
        userId: 1,
        amount: 5000,
        email: "user@test.com",
      })

      const emails = emailService.getSentEmails()
      expect(emails).toHaveLength(1)
      expect(emails[0].to).toBe("user@test.com")
      expect(emails[0].subject).toBe("Payment Successful")
      expect(emails[0].template).toBe("paymentConfirm.html")
      expect(emails[0].fields?.amount).toBe("$50.00")
    })

    it("should not send email if sendEmailOnCharge is false", async () => {
      await useCase.execute({
        userId: 1,
        amount: 5000,
        email: "user@test.com",
        sendEmailOnCharge: false,
      })

      const emails = emailService.getSentEmails()
      expect(emails).toHaveLength(0)
    })
  })

  describe("Failed Payment", () => {
    beforeEach(() => {
      userCardRepo.addCard(1, {
        card_id: "card_declined",
        square_customer_id: "cust_123",
        last_4: "0002",
        card_brand: "VISA",
        exp_month: "12",
        exp_year: "2025",
        cardholder_name: "Test User",
      })

      // Add card that will be declined
      paymentProvider.addTestCard({
        id: "card_declined",
        customerId: "cust_123",
        last4: "0002",
        cardBrand: "VISA",
        expMonth: 12,
        expYear: 2025,
      })
    })

    it("should handle declined payment", async () => {
      paymentProvider.setNextPaymentStatus("FAILED")

      const result = await useCase.execute({
        userId: 1,
        amount: 5000,
        email: "user@test.com",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("Payment failed")
        expect(result.code).toBe("PAYMENT_FAILED")
      }
    })

    it("should log failed transaction", async () => {
      paymentProvider.setNextPaymentStatus("FAILED")

      await useCase.execute({
        userId: 1,
        amount: 5000,
        email: "user@test.com",
      })

      const transactions = transactionRepo.getAll()
      expect(transactions).toHaveLength(1)
      expect(transactions[0].status).toBe("failed")
    })

    it("should send failure email to user", async () => {
      paymentProvider.setNextPaymentStatus("FAILED")

      await useCase.execute({
        userId: 1,
        amount: 5000,
        email: "user@test.com",
      })

      const emails = emailService.getSentEmails()
      const userEmail = emails.find((e) => e.to === "user@test.com")
      expect(userEmail).toBeTruthy()
      expect(userEmail?.subject).toBe("Payment Error")
      expect(userEmail?.template).toBe("paymentError.html")
    })
  })

  describe("Error Handling", () => {
    it("should send admin email on unexpected error", async () => {
      // Force an error by not setting up card data
      userCardRepo.addCard(1, {
        card_id: "card_123",
        square_customer_id: "cust_123",
        last_4: "4242",
        card_brand: "VISA",
        exp_month: "12",
        exp_year: "2025",
        cardholder_name: "Test User",
      })

      // Don't add card to payment provider to trigger error
      const result = await useCase.execute({
        userId: 1,
        amount: 5000,
        email: "user@test.com",
      })

      expect(result.success).toBe(false)

      const adminEmails = emailService.getEmailsSentTo("admin@test.com")
      expect(adminEmails.length).toBeGreaterThan(0)
      expect(adminEmails[0].subject).toBe("Payment Error")
    })
  })
})
