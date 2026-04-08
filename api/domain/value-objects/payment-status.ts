import { ValueObject } from "../base/value-object.interface"

/**
 * Valid payment status types
 */
export type PaymentStatusType = "pending" | "completed" | "failed" | "refunded"

/**
 * Payment Status Value Object
 *
 * Represents the lifecycle state of a payment
 */
export class PaymentStatus extends ValueObject<PaymentStatusType> {
  private constructor(value: PaymentStatusType) {
    super(value)
  }

  static pending(): PaymentStatus {
    return new PaymentStatus("pending")
  }

  static completed(): PaymentStatus {
    return new PaymentStatus("completed")
  }

  static failed(): PaymentStatus {
    return new PaymentStatus("failed")
  }

  static refunded(): PaymentStatus {
    return new PaymentStatus("refunded")
  }

  static from(value: string): PaymentStatus {
    const normalized = value.toLowerCase() as PaymentStatusType
    if (!this.isValidStatus(normalized)) {
      throw new Error(`Invalid payment status: ${value}`)
    }
    return new PaymentStatus(normalized)
  }

  private static isValidStatus(value: string): value is PaymentStatusType {
    return ["pending", "completed", "failed", "refunded"].includes(value)
  }

  // Status predicates
  isPending(): boolean {
    return this.value === "pending"
  }

  isCompleted(): boolean {
    return this.value === "completed"
  }

  isFailed(): boolean {
    return this.value === "failed"
  }

  isRefunded(): boolean {
    return this.value === "refunded"
  }

  // Business rules
  canComplete(): boolean {
    return this.value === "pending"
  }

  canFail(): boolean {
    return this.value === "pending"
  }

  canRefund(): boolean {
    return this.value === "completed"
  }

  protected validate(): void {
    if (!PaymentStatus.isValidStatus(this.value)) {
      throw new Error(`Invalid payment status: ${this.value}`)
    }
  }
}
