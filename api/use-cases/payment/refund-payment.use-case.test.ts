import { describe, it, expect, beforeEach, vi } from "vitest"
import { RefundPaymentUseCase } from "./refund-payment.use-case"
import { ConsoleLogger } from "@api/infrastructure/logging/console.logger"
import { MockEmailService } from "@api/infrastructure/email/mock/mock-email.service"
import { MockUserApiClient } from "@api/infrastructure/external-api/user-api/mock-user-api.client"
import { IEventBus, IDomainEvent } from "@api/infrastructure/events/event-bus.interface"

// Simple payment provider mock that doesn't require pre-seeded payment state
class MockPaymentProvider {
  private nextRefundStatus: 'COMPLETED' | 'FAILED' | 'PENDING' = 'COMPLETED'

  async refundPayment(_request: any): Promise<any> {
    return {
      id: `mock_refund_${Date.now()}`,
      status: this.nextRefundStatus,
      amountMoney: { amount: _request.amountMoney.amount, currency: 'USD' },
      environment: 'production',
    }
  }

  setNextPaymentStatus(status: 'COMPLETED' | 'FAILED' | 'PENDING') {
    this.nextRefundStatus = status
  }
}

class MockTransactionRepository {
  private transactions: any[] = []

  async findById(id: number) {
    return this.transactions.find((t) => t.transaction_id === id) || null
  }

  async findBySquareTransactionId(squareId: string) {
    return this.transactions.filter((t) => t.square_transaction_id === squareId)
  }

  async findByUserId(userId: number) {
    return this.transactions.filter((t) => t.user_id === userId)
  }

  async create(data: any) {
    const tx = { transaction_id: this.transactions.length + 1, ...data }
    this.transactions.push(tx)
    return tx
  }

  async update(id: number, data: any) {
    const idx = this.transactions.findIndex((t) => t.transaction_id === id)
    if (idx === -1) return null
    this.transactions[idx] = { ...this.transactions[idx], ...data }
    return this.transactions[idx]
  }

  async delete(): Promise<void> {}

  addTransaction(tx: any) {
    this.transactions.push(tx)
  }

  getAll() {
    return this.transactions
  }
}

class MockConfigService {
  get(key: string) {
    const config: Record<string, string> = {
      ADMIN_EMAIL: "admin@test.com",
    }
    return config[key] || ""
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

describe("RefundPaymentUseCase", () => {
  let useCase: RefundPaymentUseCase
  let transactionRepo: MockTransactionRepository
  let paymentProvider: MockPaymentProvider
  let emailService: MockEmailService
  let userApiClient: MockUserApiClient
  let eventBus: MockEventBus

  const existingTransaction = {
    transaction_id: 1,
    user_id: 10,
    amount: 25000,
    type: "payment",
    status: "completed",
    square_transaction_id: "sq_txn_abc123",
  }

  beforeEach(() => {
    transactionRepo = new MockTransactionRepository()
    paymentProvider = new MockPaymentProvider()
    emailService = new MockEmailService()
    userApiClient = new MockUserApiClient()
    eventBus = new MockEventBus()

    useCase = new RefundPaymentUseCase({
      logger: new ConsoleLogger(),
      paymentProvider,
      emailService,
      transactionRepository: transactionRepo as any,
      userApiClient,
      config: new MockConfigService() as any,
      eventBus,
    })
  })

  describe("Input Validation", () => {
    it("should fail with invalid userId (zero)", async () => {
      const result = await useCase.execute({
        userId: 0,
        squareTransactionId: "sq_txn_abc",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("REFUND_VALIDATION_ERROR")
      }
    })

    it("should fail when squareTransactionId is empty", async () => {
      const result = await useCase.execute({
        userId: 10,
        squareTransactionId: "",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("REFUND_VALIDATION_ERROR")
      }
    })
  })

  describe("Transaction Validation", () => {
    it("should fail when transaction is not found", async () => {
      const result = await useCase.execute({
        userId: 10,
        squareTransactionId: "nonexistent",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("Transaction not found")
        expect(result.code).toBe("TRANSACTION_NOT_FOUND")
      }
    })

    it("should fail when transaction is already refunded", async () => {
      transactionRepo.addTransaction({
        ...existingTransaction,
        status: "refunded",
      })

      const result = await useCase.execute({
        userId: 10,
        squareTransactionId: "sq_txn_abc123",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("ALREADY_REFUNDED")
      }
    })

    it("should fail when transaction type is not payment", async () => {
      transactionRepo.addTransaction({
        ...existingTransaction,
        type: "refund",
      })

      const result = await useCase.execute({
        userId: 10,
        squareTransactionId: "sq_txn_abc123",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("INVALID_TRANSACTION_TYPE")
      }
    })

    it("should fail when transaction amount is zero", async () => {
      transactionRepo.addTransaction({
        ...existingTransaction,
        amount: 0,
      })

      const result = await useCase.execute({
        userId: 10,
        squareTransactionId: "sq_txn_abc123",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("INVALID_AMOUNT")
      }
    })
  })

  describe("Successful Refund", () => {
    beforeEach(() => {
      transactionRepo.addTransaction(existingTransaction)
      userApiClient.addMockUser({
        id: 10,
        email: "user@test.com",
        first_name: "Test",
        last_name: "User",
        active: true,
        is_premium: true,
      })
    })

    it("should return success with refund details", async () => {
      const result = await useCase.execute({
        userId: 10,
        squareTransactionId: "sq_txn_abc123",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.amount).toBe(25000)
        expect(result.data.originalTransactionId).toBe("1")
        expect(["completed", "pending", "COMPLETED", "PENDING"]).toContain(result.data.status)
      }
    })

    it("should create a refund transaction record", async () => {
      await useCase.execute({
        userId: 10,
        squareTransactionId: "sq_txn_abc123",
      })

      const allTxs = transactionRepo.getAll()
      const refundTx = allTxs.find((t) => t.type === "refund" && t.status === "completed")
      expect(refundTx).toBeDefined()
      expect(refundTx?.user_id).toBe(10)
      expect(refundTx?.amount).toBe(25000)
    })

    it("should mark the original transaction as refunded", async () => {
      await useCase.execute({
        userId: 10,
        squareTransactionId: "sq_txn_abc123",
      })

      const original = await transactionRepo.findById(1)
      expect(original?.status).toBe("refunded")
    })

    it("should publish PaymentRefundedEvent", async () => {
      await useCase.execute({
        userId: 10,
        squareTransactionId: "sq_txn_abc123",
        email: "user@test.com",
      })

      const events = eventBus.getPublishedEvents()
      const refundEvent = events.find((e) => e.eventType === "PaymentRefunded")
      expect(refundEvent).toBeDefined()
      expect(refundEvent?.payload.userId).toBe(10)
      expect(refundEvent?.payload.amount).toBe(25000)
      expect(refundEvent?.payload.email).toBe("user@test.com")
    })

    it("should use provided email without fetching from user API", async () => {
      const mockGetUser = vi.fn().mockResolvedValue({ email: "provided@test.com" })
      const limitedClientUseCase = new RefundPaymentUseCase({
        logger: new ConsoleLogger(),
        paymentProvider: paymentProvider as any,
        emailService: new MockEmailService() as any,
        transactionRepository: transactionRepo as any,
        userApiClient: { getUser: mockGetUser } as any,
        config: new MockConfigService() as any,
        eventBus,
      })

      await limitedClientUseCase.execute({
        userId: 10,
        squareTransactionId: "sq_txn_abc123",
        email: "provided@test.com",
      })

      // Should not need to fetch user since email was provided
      expect(mockGetUser).not.toHaveBeenCalled()
    })

    it("should fetch email from user API when not provided", async () => {
      const mockGetUser = vi.fn().mockResolvedValue({ email: "user@test.com" })
      const limitedClientUseCase = new RefundPaymentUseCase({
        logger: new ConsoleLogger(),
        paymentProvider: paymentProvider as any,
        emailService: new MockEmailService() as any,
        transactionRepository: transactionRepo as any,
        userApiClient: { getUser: mockGetUser } as any,
        config: new MockConfigService() as any,
        eventBus,
      })

      await limitedClientUseCase.execute({
        userId: 10,
        squareTransactionId: "sq_txn_abc123",
      })

      expect(mockGetUser).toHaveBeenCalledWith(10)
    })
  })

  describe("Failed Refund", () => {
    beforeEach(() => {
      transactionRepo.addTransaction(existingTransaction)
    })

    it("should log a failed refund transaction when payment provider fails", async () => {
      paymentProvider.setNextPaymentStatus("FAILED")

      await useCase.execute({
        userId: 10,
        squareTransactionId: "sq_txn_abc123",
      })

      const allTxs = transactionRepo.getAll()
      const failedRefund = allTxs.find((t) => t.type === "refund" && t.status === "failed")
      expect(failedRefund).toBeDefined()
    })

    it("should return failure when refund is rejected by payment provider", async () => {
      paymentProvider.setNextPaymentStatus("FAILED")

      const result = await useCase.execute({
        userId: 10,
        squareTransactionId: "sq_txn_abc123",
      })

      expect(result.success).toBe(false)
    })
  })
})
