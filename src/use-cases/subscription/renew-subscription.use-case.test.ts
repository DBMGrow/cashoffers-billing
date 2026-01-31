import { describe, it, expect, beforeEach } from "vitest"
import { RenewSubscriptionUseCase } from "./renew-subscription.use-case"
import { ConsoleLogger } from "@/infrastructure/logging/console.logger"
import { MockPaymentProvider } from "@/infrastructure/payment/mock/mock-payment.provider"
import { MockEmailService } from "@/infrastructure/email/mock/mock-email.service"
import { ITransactionManager } from "@/infrastructure/database/transaction/transaction-manager.interface"
import { Kysely } from "kysely"
import { DB } from "@/lib/db"

// Mock repositories (reusing from create-subscription tests)
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

  // Test helper
  addSubscription(subscription: any) {
    this.subscriptions.push(subscription)
  }

  getAll() {
    return this.subscriptions
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

class MockConfigService {
  private config = new Map<string, string>([
    ["ADMIN_EMAIL", "admin@test.com"],
    ["FRONTEND_URL", "https://test.com"],
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

// Mock Transaction Manager - just executes callback without actual transaction
class MockTransactionManager implements ITransactionManager {
  async runInTransaction<T>(callback: (trx: Kysely<DB>) => Promise<T>): Promise<T> {
    // For tests, just execute the callback without actual transaction
    // Pass undefined as trx, which will cause repositories to use their default db
    return await callback(undefined as any)
  }
}

describe("RenewSubscriptionUseCase", () => {
  let useCase: RenewSubscriptionUseCase
  let logger: ConsoleLogger
  let paymentProvider: MockPaymentProvider
  let emailService: MockEmailService
  let subscriptionRepo: MockSubscriptionRepository
  let transactionRepo: MockTransactionRepository
  let userCardRepo: MockUserCardRepository
  let config: MockConfigService
  let transactionManager: MockTransactionManager

  beforeEach(() => {
    logger = new ConsoleLogger()
    paymentProvider = new MockPaymentProvider()
    emailService = new MockEmailService()
    subscriptionRepo = new MockSubscriptionRepository()
    transactionRepo = new MockTransactionRepository()
    userCardRepo = new MockUserCardRepository()
    config = new MockConfigService()
    transactionManager = new MockTransactionManager()

    useCase = new RenewSubscriptionUseCase({
      logger,
      paymentProvider,
      emailService,
      subscriptionRepository: subscriptionRepo as any,
      transactionRepository: transactionRepo as any,
      userCardRepository: userCardRepo as any,
      config: config as any,
      transactionManager,
    })
  })

  describe("Validation", () => {
    it("should fail if subscription not found", async () => {
      const result = await useCase.execute({
        subscriptionId: 999,
        email: "user@test.com",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("Subscription not found")
        expect(result.code).toBe("SUBSCRIPTION_NOT_FOUND")
      }
    })

    it("should validate subscriptionId is positive", async () => {
      const result = await useCase.execute({
        subscriptionId: 0,
        email: "user@test.com",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain("positive integer")
      }
    })

    it("should validate email format", async () => {
      const result = await useCase.execute({
        subscriptionId: 1,
        email: "invalid-email",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain("Invalid email")
      }
    })
  })

  describe("Successful Renewal", () => {
    beforeEach(() => {
      // Add subscription
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 1,
        subscription_name: "CashOffers.PRO",
        product_id: 1,
        amount: 25000,
        duration: "monthly",
        renewal_date: new Date("2024-01-01"),
        next_renewal_attempt: new Date("2024-01-01"),
        status: "active",
        data: JSON.stringify({ renewal_cost: 25000 }),
      })

      // Add user card
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

    it("should renew subscription successfully", async () => {
      const result = await useCase.execute({
        subscriptionId: 1,
        email: "user@test.com",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.subscriptionId).toBe(1)
        expect(result.data.amount).toBe(25000)
        expect(result.data.nextRenewalDate).toBeInstanceOf(Date)
      }
    })

    it("should process payment for renewal", async () => {
      await useCase.execute({
        subscriptionId: 1,
        email: "user@test.com",
      })

      const payments = paymentProvider.getPayments()
      expect(payments).toHaveLength(1)
      expect(payments[0].amountMoney.amount).toBe(BigInt(25000))
      expect(payments[0].status).toBe("COMPLETED")
    })

    it("should update subscription renewal date", async () => {
      const originalRenewalDate = new Date("2024-01-01")

      await useCase.execute({
        subscriptionId: 1,
        email: "user@test.com",
      })

      const subscription = await subscriptionRepo.findById(1)
      expect(subscription?.renewal_date).toBeInstanceOf(Date)
      expect(subscription?.renewal_date.getTime()).toBeGreaterThan(originalRenewalDate.getTime())
    })

    it("should calculate monthly renewal date correctly", async () => {
      await useCase.execute({
        subscriptionId: 1,
        email: "user@test.com",
      })

      const subscription = await subscriptionRepo.findById(1)
      const originalDate = new Date("2024-01-01")
      const expectedDate = new Date("2024-02-01")

      expect(subscription?.renewal_date.toDateString()).toBe(expectedDate.toDateString())
    })

    it("should send renewal email", async () => {
      await useCase.execute({
        subscriptionId: 1,
        email: "user@test.com",
      })

      const emails = emailService.getSentEmails()
      expect(emails).toHaveLength(1)
      expect(emails[0].to).toBe("user@test.com")
      expect(emails[0].subject).toBe("Subscription Renewal")
      expect(emails[0].template).toBe("subscriptionRenewal.html")
    })

    it("should log transaction", async () => {
      await useCase.execute({
        subscriptionId: 1,
        email: "user@test.com",
      })

      const transactions = transactionRepo.getAll()
      expect(transactions).toHaveLength(1)
      expect(transactions[0].user_id).toBe(1)
      expect(transactions[0].amount).toBe(25000)
      expect(transactions[0].type).toBe("subscription")
      expect(transactions[0].status).toBe("completed")
    })

    it("should reactivate suspended subscription", async () => {
      // Update subscription to suspended
      await subscriptionRepo.update(1, { status: "suspend" })

      await useCase.execute({
        subscriptionId: 1,
        email: "user@test.com",
      })

      const subscription = await subscriptionRepo.findById(1)
      expect(subscription?.status).toBe("active")
    })
  })

  describe("Renewal Date Calculation", () => {
    it("should calculate daily renewal correctly", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 2,
        user_id: 1,
        subscription_name: "Daily Plan",
        product_id: 1,
        amount: 100,
        duration: "daily",
        renewal_date: new Date("2024-01-01"),
        status: "active",
      })

      userCardRepo.addCard(1, {
        card_id: "card_123",
        square_customer_id: "cust_123",
        last_4: "4242",
        card_brand: "VISA",
        exp_month: "12",
        exp_year: "2025",
        cardholder_name: "Test User",
      })

      paymentProvider.addTestCard({
        id: "card_123",
        customerId: "cust_123",
        last4: "4242",
        cardBrand: "VISA",
        expMonth: 12,
        expYear: 2025,
      })

      await useCase.execute({
        subscriptionId: 2,
        email: "user@test.com",
      })

      const subscription = await subscriptionRepo.findById(2)
      const expectedDate = new Date("2024-01-02")
      expect(subscription?.renewal_date.toDateString()).toBe(expectedDate.toDateString())
    })

    it("should calculate weekly renewal correctly", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 3,
        user_id: 1,
        subscription_name: "Weekly Plan",
        product_id: 1,
        amount: 500,
        duration: "weekly",
        renewal_date: new Date("2024-01-01"),
        status: "active",
      })

      userCardRepo.addCard(1, {
        card_id: "card_123",
        square_customer_id: "cust_123",
        last_4: "4242",
        card_brand: "VISA",
        exp_month: "12",
        exp_year: "2025",
        cardholder_name: "Test User",
      })

      paymentProvider.addTestCard({
        id: "card_123",
        customerId: "cust_123",
        last4: "4242",
        cardBrand: "VISA",
        expMonth: 12,
        expYear: 2025,
      })

      await useCase.execute({
        subscriptionId: 3,
        email: "user@test.com",
      })

      const subscription = await subscriptionRepo.findById(3)
      const expectedDate = new Date("2024-01-08")
      expect(subscription?.renewal_date.toDateString()).toBe(expectedDate.toDateString())
    })

    it("should calculate yearly renewal correctly", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 4,
        user_id: 1,
        subscription_name: "Yearly Plan",
        product_id: 1,
        amount: 100000,
        duration: "yearly",
        renewal_date: new Date("2024-01-01"),
        status: "active",
      })

      userCardRepo.addCard(1, {
        card_id: "card_123",
        square_customer_id: "cust_123",
        last_4: "4242",
        card_brand: "VISA",
        exp_month: "12",
        exp_year: "2025",
        cardholder_name: "Test User",
      })

      paymentProvider.addTestCard({
        id: "card_123",
        customerId: "cust_123",
        last4: "4242",
        cardBrand: "VISA",
        expMonth: 12,
        expYear: 2025,
      })

      await useCase.execute({
        subscriptionId: 4,
        email: "user@test.com",
      })

      const subscription = await subscriptionRepo.findById(4)
      const expectedDate = new Date("2025-01-01")
      expect(subscription?.renewal_date.toDateString()).toBe(expectedDate.toDateString())
    })
  })

  describe("Failed Renewal", () => {
    beforeEach(() => {
      subscriptionRepo.addSubscription({
        subscription_id: 1,
        user_id: 1,
        subscription_name: "CashOffers.PRO",
        product_id: 1,
        amount: 25000,
        duration: "monthly",
        renewal_date: new Date("2024-01-01"),
        next_renewal_attempt: new Date("2024-01-01"),
        status: "active",
      })

      userCardRepo.addCard(1, {
        card_id: "card_declined",
        square_customer_id: "cust_123",
        last_4: "0002",
        card_brand: "VISA",
        exp_month: "12",
        exp_year: "2025",
        cardholder_name: "Test User",
      })

      paymentProvider.addTestCard({
        id: "card_declined",
        customerId: "cust_123",
        last4: "0002",
        cardBrand: "VISA",
        expMonth: 12,
        expYear: 2025,
      })
    })

    it("should handle payment failure", async () => {
      paymentProvider.setNextPaymentStatus("FAILED")

      const result = await useCase.execute({
        subscriptionId: 1,
        email: "user@test.com",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("Payment failed")
        expect(result.code).toBe("RENEWAL_ERROR")
      }
    })

    it("should send failure email", async () => {
      paymentProvider.setNextPaymentStatus("FAILED")

      await useCase.execute({
        subscriptionId: 1,
        email: "user@test.com",
      })

      const emails = emailService.getSentEmails()
      const failureEmail = emails.find((e) => e.to === "user@test.com")
      expect(failureEmail).toBeTruthy()
      expect(failureEmail?.subject).toBe("Subscription Renewal Failed")
      expect(failureEmail?.template).toBe("subscriptionRenewalFailed.html")
    })

    it("should update next renewal attempt on failure", async () => {
      paymentProvider.setNextPaymentStatus("FAILED")

      await useCase.execute({
        subscriptionId: 1,
        email: "user@test.com",
      })

      const subscription = await subscriptionRepo.findById(1)
      expect(subscription?.next_renewal_attempt).toBeInstanceOf(Date)
      // Should be rescheduled for retry
      expect(subscription?.next_renewal_attempt.getTime()).toBeGreaterThan(Date.now())
    })

    it("should log failed transaction", async () => {
      paymentProvider.setNextPaymentStatus("FAILED")

      await useCase.execute({
        subscriptionId: 1,
        email: "user@test.com",
      })

      const transactions = transactionRepo.getAll()
      const failedTx = transactions.find((t) => t.status === "failed")
      expect(failedTx).toBeTruthy()
      expect(failedTx?.user_id).toBe(1)
      expect(failedTx?.type).toBe("subscription")
    })
  })

  describe("Zero Amount Subscriptions", () => {
    it("should handle free subscriptions", async () => {
      subscriptionRepo.addSubscription({
        subscription_id: 5,
        user_id: 1,
        subscription_name: "Free Trial",
        product_id: 1,
        amount: 0,
        duration: "monthly",
        renewal_date: new Date("2024-01-01"),
        status: "active",
      })

      const result = await useCase.execute({
        subscriptionId: 5,
        email: "user@test.com",
      })

      expect(result.success).toBe(true)

      // Should not create a payment
      const payments = paymentProvider.getPayments()
      expect(payments).toHaveLength(0)

      // Should still update renewal date
      const subscription = await subscriptionRepo.findById(5)
      expect(subscription?.renewal_date).toBeInstanceOf(Date)
    })
  })
})
