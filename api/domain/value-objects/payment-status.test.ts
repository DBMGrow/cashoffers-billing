import { describe, it, expect } from "vitest"
import { PaymentStatus } from "./payment-status"

describe("PaymentStatus", () => {
  describe("Creation", () => {
    it("should create pending status", () => {
      const status = PaymentStatus.pending()
      expect(status.value).toBe("pending")
      expect(status.isPending()).toBe(true)
    })

    it("should create completed status", () => {
      const status = PaymentStatus.completed()
      expect(status.value).toBe("completed")
      expect(status.isCompleted()).toBe(true)
    })

    it("should create failed status", () => {
      const status = PaymentStatus.failed()
      expect(status.value).toBe("failed")
      expect(status.isFailed()).toBe(true)
    })

    it("should create refunded status", () => {
      const status = PaymentStatus.refunded()
      expect(status.value).toBe("refunded")
      expect(status.isRefunded()).toBe(true)
    })

    it("should create from valid string", () => {
      expect(PaymentStatus.from("pending").isPending()).toBe(true)
      expect(PaymentStatus.from("completed").isCompleted()).toBe(true)
      expect(PaymentStatus.from("failed").isFailed()).toBe(true)
      expect(PaymentStatus.from("refunded").isRefunded()).toBe(true)
    })

    it("should normalize case when creating from string", () => {
      expect(PaymentStatus.from("PENDING").isPending()).toBe(true)
      expect(PaymentStatus.from("Completed").isCompleted()).toBe(true)
    })

    it("should throw error for invalid status", () => {
      expect(() => PaymentStatus.from("invalid")).toThrow(
        "Invalid payment status: invalid"
      )
    })
  })

  describe("Status Predicates", () => {
    it("should identify pending status", () => {
      const status = PaymentStatus.pending()
      expect(status.isPending()).toBe(true)
      expect(status.isCompleted()).toBe(false)
      expect(status.isFailed()).toBe(false)
      expect(status.isRefunded()).toBe(false)
    })

    it("should identify completed status", () => {
      const status = PaymentStatus.completed()
      expect(status.isCompleted()).toBe(true)
      expect(status.isPending()).toBe(false)
      expect(status.isFailed()).toBe(false)
      expect(status.isRefunded()).toBe(false)
    })

    it("should identify failed status", () => {
      const status = PaymentStatus.failed()
      expect(status.isFailed()).toBe(true)
      expect(status.isPending()).toBe(false)
      expect(status.isCompleted()).toBe(false)
      expect(status.isRefunded()).toBe(false)
    })

    it("should identify refunded status", () => {
      const status = PaymentStatus.refunded()
      expect(status.isRefunded()).toBe(true)
      expect(status.isPending()).toBe(false)
      expect(status.isCompleted()).toBe(false)
      expect(status.isFailed()).toBe(false)
    })
  })

  describe("Business Rules", () => {
    it("should allow completion from pending", () => {
      const status = PaymentStatus.pending()
      expect(status.canComplete()).toBe(true)
    })

    it("should not allow completion from completed", () => {
      const status = PaymentStatus.completed()
      expect(status.canComplete()).toBe(false)
    })

    it("should not allow completion from failed", () => {
      const status = PaymentStatus.failed()
      expect(status.canComplete()).toBe(false)
    })

    it("should not allow completion from refunded", () => {
      const status = PaymentStatus.refunded()
      expect(status.canComplete()).toBe(false)
    })

    it("should allow failure from pending", () => {
      const status = PaymentStatus.pending()
      expect(status.canFail()).toBe(true)
    })

    it("should not allow failure from completed", () => {
      const status = PaymentStatus.completed()
      expect(status.canFail()).toBe(false)
    })

    it("should not allow failure from failed", () => {
      const status = PaymentStatus.failed()
      expect(status.canFail()).toBe(false)
    })

    it("should allow refund from completed", () => {
      const status = PaymentStatus.completed()
      expect(status.canRefund()).toBe(true)
    })

    it("should not allow refund from pending", () => {
      const status = PaymentStatus.pending()
      expect(status.canRefund()).toBe(false)
    })

    it("should not allow refund from failed", () => {
      const status = PaymentStatus.failed()
      expect(status.canRefund()).toBe(false)
    })

    it("should not allow refund from refunded", () => {
      const status = PaymentStatus.refunded()
      expect(status.canRefund()).toBe(false)
    })
  })

  describe("Equality", () => {
    it("should be equal to another status with same value", () => {
      const status1 = PaymentStatus.pending()
      const status2 = PaymentStatus.pending()
      expect(status1.equals(status2)).toBe(true)
    })

    it("should not be equal to status with different value", () => {
      const status1 = PaymentStatus.pending()
      const status2 = PaymentStatus.completed()
      expect(status1.equals(status2)).toBe(false)
    })
  })
})
