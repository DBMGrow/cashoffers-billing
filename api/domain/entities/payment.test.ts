import { describe, it, expect } from "vitest"
import { Payment } from "./payment"
import { Money } from "../value-objects/money"
import { PaymentStatus } from "../value-objects/payment-status"

describe("Payment Entity", () => {
  const createTestPayment = (overrides = {}) => {
    return Payment.create({
      id: 1,
      userId: 1,
      amount: Money.fromCents(25000),
      status: PaymentStatus.pending(),
      squareTransactionId: null,
      memo: "Test payment",
      metadata: null,
      ...overrides,
    })
  }

  describe("Creation", () => {
    it("should create a valid payment", () => {
      const payment = createTestPayment()

      expect(payment.id).toBe(1)
      expect(payment.userId).toBe(1)
      expect(payment.amount.cents).toBe(25000)
      expect(payment.isPending()).toBe(true)
      expect(payment.memo).toBe("Test payment")
    })

    it("should throw error for invalid userId", () => {
      expect(() => createTestPayment({ userId: 0 })).toThrow(
        "Payment must have a valid userId"
      )
    })

    it("should throw error for negative amount", () => {
      expect(() =>
        createTestPayment({ amount: Money.fromCents(-100) })
      ).toThrow("Payment amount cannot be negative")
    })

    it("should allow zero amount", () => {
      const payment = createTestPayment({ amount: Money.fromCents(0) })
      expect(payment.amount.cents).toBe(0)
    })

    it("should reconstitute from persistence", () => {
      const props = {
        id: 1,
        userId: 1,
        amount: Money.fromCents(5000),
        status: PaymentStatus.completed(),
        squareTransactionId: "sq_123",
        memo: "Test",
        metadata: { test: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const payment = Payment.from(props)
      expect(payment.id).toBe(1)
      expect(payment.isCompleted()).toBe(true)
      expect(payment.squareTransactionId).toBe("sq_123")
    })
  })

  describe("Status Predicates", () => {
    it("should identify pending payment", () => {
      const payment = createTestPayment({
        status: PaymentStatus.pending(),
      })

      expect(payment.isPending()).toBe(true)
      expect(payment.isCompleted()).toBe(false)
      expect(payment.isFailed()).toBe(false)
      expect(payment.isRefunded()).toBe(false)
    })

    it("should identify completed payment", () => {
      const payment = createTestPayment({
        status: PaymentStatus.completed(),
      })

      expect(payment.isCompleted()).toBe(true)
      expect(payment.isPending()).toBe(false)
    })

    it("should identify failed payment", () => {
      const payment = createTestPayment({
        status: PaymentStatus.failed(),
      })

      expect(payment.isFailed()).toBe(true)
      expect(payment.isPending()).toBe(false)
    })

    it("should identify refunded payment", () => {
      const payment = createTestPayment({
        status: PaymentStatus.refunded(),
      })

      expect(payment.isRefunded()).toBe(true)
      expect(payment.isCompleted()).toBe(false)
    })
  })

  describe("Business Rules - Completion", () => {
    it("should complete pending payment", () => {
      const payment = createTestPayment()
      const completed = payment.complete("sq_123")

      expect(completed.isCompleted()).toBe(true)
      expect(completed.squareTransactionId).toBe("sq_123")
      expect(completed.id).toBe(payment.id)
    })

    it("should not complete already completed payment", () => {
      const payment = createTestPayment({
        status: PaymentStatus.completed(),
      })

      expect(() => payment.complete("sq_123")).toThrow(
        "Cannot complete payment"
      )
    })

    it("should not complete failed payment", () => {
      const payment = createTestPayment({
        status: PaymentStatus.failed(),
      })

      expect(() => payment.complete("sq_123")).toThrow(
        "Cannot complete payment"
      )
    })

    it("should not complete refunded payment", () => {
      const payment = createTestPayment({
        status: PaymentStatus.refunded(),
      })

      expect(() => payment.complete("sq_123")).toThrow(
        "Cannot complete payment"
      )
    })

    it("should require transaction ID to complete", () => {
      const payment = createTestPayment()

      expect(() => payment.complete("")).toThrow(
        "Square transaction ID is required"
      )
    })
  })

  describe("Business Rules - Failure", () => {
    it("should fail pending payment", () => {
      const payment = createTestPayment()
      const failed = payment.fail()

      expect(failed.isFailed()).toBe(true)
    })

    it("should fail pending payment with reason", () => {
      const payment = createTestPayment()
      const failed = payment.fail("Insufficient funds")

      expect(failed.isFailed()).toBe(true)
      expect(failed.metadata?.failureReason).toBe("Insufficient funds")
    })

    it("should not fail already completed payment", () => {
      const payment = createTestPayment({
        status: PaymentStatus.completed(),
      })

      expect(() => payment.fail()).toThrow("Cannot fail payment")
    })

    it("should not fail already failed payment", () => {
      const payment = createTestPayment({
        status: PaymentStatus.failed(),
      })

      expect(() => payment.fail()).toThrow("Cannot fail payment")
    })

    it("should preserve existing metadata when failing", () => {
      const payment = createTestPayment({
        metadata: { orderId: "123" },
      })
      const failed = payment.fail("Card declined")

      expect(failed.metadata?.orderId).toBe("123")
      expect(failed.metadata?.failureReason).toBe("Card declined")
    })
  })

  describe("Business Rules - Refund", () => {
    it("should refund completed payment", () => {
      const payment = createTestPayment({
        status: PaymentStatus.completed(),
        squareTransactionId: "sq_123",
      })
      const refunded = payment.refund("sq_refund_456")

      expect(refunded.isRefunded()).toBe(true)
      expect(refunded.metadata?.refundTransactionId).toBe("sq_refund_456")
      expect(refunded.metadata?.refundedAt).toBeDefined()
    })

    it("should not refund pending payment", () => {
      const payment = createTestPayment()

      expect(() => payment.refund("sq_refund_456")).toThrow(
        "Cannot refund payment"
      )
    })

    it("should not refund failed payment", () => {
      const payment = createTestPayment({
        status: PaymentStatus.failed(),
      })

      expect(() => payment.refund("sq_refund_456")).toThrow(
        "Cannot refund payment"
      )
    })

    it("should not refund already refunded payment", () => {
      const payment = createTestPayment({
        status: PaymentStatus.refunded(),
      })

      expect(() => payment.refund("sq_refund_456")).toThrow(
        "Cannot refund payment"
      )
    })

    it("should require refund transaction ID", () => {
      const payment = createTestPayment({
        status: PaymentStatus.completed(),
      })

      expect(() => payment.refund("")).toThrow(
        "Refund transaction ID is required"
      )
    })

    it("should preserve existing metadata when refunding", () => {
      const payment = createTestPayment({
        status: PaymentStatus.completed(),
        metadata: { orderId: "123" },
      })
      const refunded = payment.refund("sq_refund_456")

      expect(refunded.metadata?.orderId).toBe("123")
      expect(refunded.metadata?.refundTransactionId).toBe("sq_refund_456")
    })
  })

  describe("Business Rules - Metadata Updates", () => {
    it("should update metadata", () => {
      const payment = createTestPayment()
      const updated = payment.updateMetadata({ orderId: "123" })

      expect(updated.metadata?.orderId).toBe("123")
    })

    it("should merge with existing metadata", () => {
      const payment = createTestPayment({
        metadata: { orderId: "123" },
      })
      const updated = payment.updateMetadata({ customerId: "456" })

      expect(updated.metadata?.orderId).toBe("123")
      expect(updated.metadata?.customerId).toBe("456")
    })

    it("should override existing metadata keys", () => {
      const payment = createTestPayment({
        metadata: { status: "old" },
      })
      const updated = payment.updateMetadata({ status: "new" })

      expect(updated.metadata?.status).toBe("new")
    })
  })

  describe("Persistence", () => {
    it("should convert to object for persistence", () => {
      const payment = createTestPayment()
      const obj = payment.toObject()

      expect(obj.id).toBe(1)
      expect(obj.userId).toBe(1)
      expect(obj.amount.cents).toBe(25000)
      expect(obj.memo).toBe("Test payment")
    })
  })

  describe("Immutability", () => {
    it("should return new instance on completion", () => {
      const payment = createTestPayment()
      const completed = payment.complete("sq_123")

      expect(completed).not.toBe(payment)
      expect(payment.isPending()).toBe(true)
      expect(completed.isCompleted()).toBe(true)
    })

    it("should return new instance on failure", () => {
      const payment = createTestPayment()
      const failed = payment.fail()

      expect(failed).not.toBe(payment)
      expect(payment.isPending()).toBe(true)
      expect(failed.isFailed()).toBe(true)
    })

    it("should return new instance on refund", () => {
      const payment = createTestPayment({
        status: PaymentStatus.completed(),
      })
      const refunded = payment.refund("sq_refund_456")

      expect(refunded).not.toBe(payment)
      expect(payment.isCompleted()).toBe(true)
      expect(refunded.isRefunded()).toBe(true)
    })

    it("should preserve original on metadata update", () => {
      const payment = createTestPayment()
      const updated = payment.updateMetadata({ test: true })

      expect(payment.metadata).toBeNull()
      expect(updated.metadata?.test).toBe(true)
    })
  })
})
