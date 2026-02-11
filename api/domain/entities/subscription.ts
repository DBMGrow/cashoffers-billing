import { Entity } from "../base/entity.interface"
import { Money } from "../value-objects/money"
import { SubscriptionStatus } from "../value-objects/subscription-status"
import { Duration } from "../value-objects/duration"

/**
 * Subscription Props
 */
export interface SubscriptionProps {
  id: number
  userId: number
  subscriptionName: string
  productId: number
  amount: Money
  duration: Duration
  renewalDate: Date
  nextRenewalAttempt: Date | null
  status: SubscriptionStatus
  data: string | null
  cancelOnRenewal: boolean
  downgradeOnRenewal: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Subscription Domain Entity
 *
 * Business Rules:
 * - Can only be cancelled or suspended if active
 * - Can only be renewed if active or suspended
 * - Renewal date must be in the future
 * - Amount must be non-negative
 * - Must have a valid duration
 */
export class Subscription extends Entity<number> {
  private constructor(
    private props: SubscriptionProps
  ) {
    super(props.id, props.createdAt, props.updatedAt)
    this.validate()
  }

  /**
   * Create a new subscription
   */
  static create(props: Omit<SubscriptionProps, "createdAt" | "updatedAt">): Subscription {
    const now = new Date()
    return new Subscription({
      ...props,
      createdAt: now,
      updatedAt: now,
    })
  }

  /**
   * Reconstitute subscription from persistence
   */
  static from(props: SubscriptionProps): Subscription {
    return new Subscription(props)
  }

  // Getters
  get userId(): number {
    return this.props.userId
  }

  get subscriptionName(): string {
    return this.props.subscriptionName
  }

  get productId(): number {
    return this.props.productId
  }

  get amount(): Money {
    return this.props.amount
  }

  get duration(): Duration {
    return this.props.duration
  }

  get renewalDate(): Date {
    return this.props.renewalDate
  }

  get nextRenewalAttempt(): Date | null {
    return this.props.nextRenewalAttempt
  }

  get status(): SubscriptionStatus {
    return this.props.status
  }

  get data(): string | null {
    return this.props.data
  }

  get cancelOnRenewal(): boolean {
    return this.props.cancelOnRenewal
  }

  get downgradeOnRenewal(): boolean {
    return this.props.downgradeOnRenewal
  }

  // Predicates
  isActive(): boolean {
    return this.props.status.isActive()
  }

  isSuspended(): boolean {
    return this.props.status.isSuspended()
  }

  isCancelled(): boolean {
    return this.props.status.isCancelled()
  }

  isDisabled(): boolean {
    return this.props.status.isDisabled()
  }

  isDueForRenewal(): boolean {
    return this.renewalDate <= new Date()
  }

  canRenew(): boolean {
    return this.props.status.canRenew() && this.isDueForRenewal()
  }

  canCancel(): boolean {
    return this.props.status.canCancel()
  }

  // Business Methods

  /**
   * Cancel the subscription
   * Business Rule: Can only cancel if active or suspended
   */
  cancel(): Subscription {
    if (!this.canCancel()) {
      throw new Error(`Cannot cancel subscription in ${this.status.value} status`)
    }

    return new Subscription({
      ...this.props,
      status: SubscriptionStatus.cancelled(),
      updatedAt: new Date(),
    })
  }

  /**
   * Suspend the subscription
   * Business Rule: Can only suspend if active
   */
  suspend(): Subscription {
    if (!this.isActive()) {
      throw new Error(`Cannot suspend subscription in ${this.status.value} status`)
    }

    return new Subscription({
      ...this.props,
      status: SubscriptionStatus.suspended(),
      updatedAt: new Date(),
    })
  }

  /**
   * Reactivate a suspended subscription
   * Business Rule: Can only reactivate if suspended
   */
  reactivate(): Subscription {
    if (!this.isSuspended()) {
      throw new Error(`Cannot reactivate subscription in ${this.status.value} status`)
    }

    return new Subscription({
      ...this.props,
      status: SubscriptionStatus.active(),
      updatedAt: new Date(),
    })
  }

  /**
   * Mark for cancellation on next renewal
   */
  markForCancellationOnRenewal(): Subscription {
    if (!this.canCancel()) {
      throw new Error(`Cannot mark for cancellation in ${this.status.value} status`)
    }

    return new Subscription({
      ...this.props,
      cancelOnRenewal: true,
      updatedAt: new Date(),
    })
  }

  /**
   * Mark for downgrade on next renewal
   */
  markForDowngradeOnRenewal(): Subscription {
    if (!this.isActive()) {
      throw new Error(`Cannot mark for downgrade in ${this.status.value} status`)
    }

    return new Subscription({
      ...this.props,
      downgradeOnRenewal: true,
      updatedAt: new Date(),
    })
  }

  /**
   * Process renewal
   * Business Rule: Can only renew if active or suspended
   */
  renew(): Subscription {
    if (!this.canRenew()) {
      throw new Error(`Cannot renew subscription in ${this.status.value} status`)
    }

    // Check if marked for cancellation
    if (this.cancelOnRenewal) {
      return this.cancel()
    }

    // Calculate next renewal date
    const nextRenewalDate = this.duration.calculateNextRenewalDate(this.renewalDate)

    return new Subscription({
      ...this.props,
      renewalDate: nextRenewalDate,
      nextRenewalAttempt: nextRenewalDate,
      status: SubscriptionStatus.active(), // Reactivate if suspended
      cancelOnRenewal: false,
      downgradeOnRenewal: false,
      updatedAt: new Date(),
    })
  }

  /**
   * Schedule next renewal attempt (for failed renewals)
   */
  scheduleNextRenewalAttempt(nextAttempt: Date): Subscription {
    return new Subscription({
      ...this.props,
      nextRenewalAttempt: nextAttempt,
      updatedAt: new Date(),
    })
  }

  /**
   * Update subscription amount
   * Business Rule: Amount must be non-negative
   */
  updateAmount(newAmount: Money): Subscription {
    if (newAmount.isNegative()) {
      throw new Error("Subscription amount cannot be negative")
    }

    return new Subscription({
      ...this.props,
      amount: newAmount,
      updatedAt: new Date(),
    })
  }

  /**
   * Update subscription product
   */
  updateProduct(productId: number, newAmount: Money): Subscription {
    if (newAmount.isNegative()) {
      throw new Error("Subscription amount cannot be negative")
    }

    return new Subscription({
      ...this.props,
      productId,
      amount: newAmount,
      updatedAt: new Date(),
    })
  }

  /**
   * Convert to plain object for persistence
   */
  toObject(): SubscriptionProps {
    return { ...this.props }
  }

  protected validate(): void {
    super.validate()

    if (!this.props.userId || this.props.userId <= 0) {
      throw new Error("Subscription must have a valid userId")
    }

    if (!this.props.subscriptionName || this.props.subscriptionName.trim() === "") {
      throw new Error("Subscription must have a name")
    }

    if (!this.props.productId || this.props.productId <= 0) {
      throw new Error("Subscription must have a valid productId")
    }

    if (this.props.amount.isNegative()) {
      throw new Error("Subscription amount cannot be negative")
    }

    if (!this.props.renewalDate) {
      throw new Error("Subscription must have a renewal date")
    }
  }
}
