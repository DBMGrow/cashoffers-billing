import { Entity } from "../base/entity.interface"
import { Money } from "../value-objects/money"
import { PaymentStatus } from "../value-objects/payment-status"

/**
 * Payment Props
 */
export interface PaymentProps {
  id: number
  userId: number
  amount: Money
  status: PaymentStatus
  squareTransactionId: string | null
  memo: string | null
  metadata: Record<string, any> | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Payment Domain Entity
 *
 * Business Rules:
 * - Can only complete a pending payment
 * - Can only fail a pending payment
 * - Can only refund a completed payment
 * - Amount must be non-negative
 * - Once completed/failed/refunded, cannot change status except refund
 */
export class Payment extends Entity<number> {
  private constructor(private props: PaymentProps) {
    super(props.id, props.createdAt, props.updatedAt)
    this.validate()
  }

  /**
   * Create a new payment
   */
  static create(props: Omit<PaymentProps, "createdAt" | "updatedAt">): Payment {
    const now = new Date()
    return new Payment({
      ...props,
      createdAt: now,
      updatedAt: now,
    })
  }

  /**
   * Reconstitute payment from persistence
   */
  static from(props: PaymentProps): Payment {
    return new Payment(props)
  }

  // Getters
  get userId(): number {
    return this.props.userId
  }

  get amount(): Money {
    return this.props.amount
  }

  get status(): PaymentStatus {
    return this.props.status
  }

  get squareTransactionId(): string | null {
    return this.props.squareTransactionId
  }

  get memo(): string | null {
    return this.props.memo
  }

  get metadata(): Record<string, any> | null {
    return this.props.metadata
  }

  // Predicates
  isPending(): boolean {
    return this.props.status.isPending()
  }

  isCompleted(): boolean {
    return this.props.status.isCompleted()
  }

  isFailed(): boolean {
    return this.props.status.isFailed()
  }

  isRefunded(): boolean {
    return this.props.status.isRefunded()
  }

  canComplete(): boolean {
    return this.props.status.canComplete()
  }

  canFail(): boolean {
    return this.props.status.canFail()
  }

  canRefund(): boolean {
    return this.props.status.canRefund()
  }

  // Business Methods

  /**
   * Complete the payment
   * Business Rule: Can only complete pending payments
   */
  complete(squareTransactionId: string): Payment {
    if (!this.canComplete()) {
      throw new Error(`Cannot complete payment in ${this.status.value} status`)
    }

    if (!squareTransactionId || squareTransactionId.trim() === "") {
      throw new Error("Square transaction ID is required to complete payment")
    }

    return new Payment({
      ...this.props,
      status: PaymentStatus.completed(),
      squareTransactionId,
      updatedAt: new Date(),
    })
  }

  /**
   * Mark payment as failed
   * Business Rule: Can only fail pending payments
   */
  fail(reason?: string): Payment {
    if (!this.canFail()) {
      throw new Error(`Cannot fail payment in ${this.status.value} status`)
    }

    const metadata = reason
      ? { ...this.props.metadata, failureReason: reason }
      : this.props.metadata

    return new Payment({
      ...this.props,
      status: PaymentStatus.failed(),
      metadata,
      updatedAt: new Date(),
    })
  }

  /**
   * Refund the payment
   * Business Rule: Can only refund completed payments
   */
  refund(refundTransactionId: string): Payment {
    if (!this.canRefund()) {
      throw new Error(`Cannot refund payment in ${this.status.value} status`)
    }

    if (!refundTransactionId || refundTransactionId.trim() === "") {
      throw new Error("Refund transaction ID is required")
    }

    return new Payment({
      ...this.props,
      status: PaymentStatus.refunded(),
      metadata: {
        ...this.props.metadata,
        refundTransactionId,
        refundedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
  }

  /**
   * Update payment metadata
   */
  updateMetadata(metadata: Record<string, any>): Payment {
    return new Payment({
      ...this.props,
      metadata: { ...this.props.metadata, ...metadata },
      updatedAt: new Date(),
    })
  }

  /**
   * Convert to plain object for persistence
   */
  toObject(): PaymentProps {
    return { ...this.props }
  }

  protected validate(): void {
    super.validate()

    if (!this.props.userId || this.props.userId <= 0) {
      throw new Error("Payment must have a valid userId")
    }

    if (this.props.amount.isNegative()) {
      throw new Error("Payment amount cannot be negative")
    }
  }
}
