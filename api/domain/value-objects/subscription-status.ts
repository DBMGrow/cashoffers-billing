import { ValueObject } from "../base/value-object.interface"

/**
 * Subscription Status Value Object
 * Represents the state of a subscription
 */
export enum SubscriptionStatusType {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  CANCELLED = "cancelled",
  DISABLED = "disabled",
  TRIAL = "trial",
  PAUSED = "paused",
  INACTIVE = "inactive",
  EXPIRED = "expired",
}

export class SubscriptionStatus extends ValueObject<SubscriptionStatusType> {
  private constructor(value: SubscriptionStatusType) {
    super(value)
  }

  static active(): SubscriptionStatus {
    return new SubscriptionStatus(SubscriptionStatusType.ACTIVE)
  }

  static suspended(): SubscriptionStatus {
    return new SubscriptionStatus(SubscriptionStatusType.SUSPENDED)
  }

  static cancelled(): SubscriptionStatus {
    return new SubscriptionStatus(SubscriptionStatusType.CANCELLED)
  }

  static disabled(): SubscriptionStatus {
    return new SubscriptionStatus(SubscriptionStatusType.DISABLED)
  }

  static trial(): SubscriptionStatus {
    return new SubscriptionStatus(SubscriptionStatusType.TRIAL)
  }

  static paused(): SubscriptionStatus {
    return new SubscriptionStatus(SubscriptionStatusType.PAUSED)
  }

  static inactive(): SubscriptionStatus {
    return new SubscriptionStatus(SubscriptionStatusType.INACTIVE)
  }

  static expired(): SubscriptionStatus {
    return new SubscriptionStatus(SubscriptionStatusType.EXPIRED)
  }

  static fromString(status: string): SubscriptionStatus {
    switch (status.toLowerCase()) {
      case "active":
        return SubscriptionStatus.active()
      case "suspended":
        return SubscriptionStatus.suspended()
      case "cancelled":
        return SubscriptionStatus.cancelled()
      case "disabled":
        return SubscriptionStatus.disabled()
      case "trial":
        return SubscriptionStatus.trial()
      case "paused":
        return SubscriptionStatus.paused()
      case "inactive":
        return SubscriptionStatus.inactive()
      case "expired":
        return SubscriptionStatus.expired()
      default:
        throw new Error(`Invalid subscription status: ${status}`)
    }
  }

  isActive(): boolean {
    return this.value === SubscriptionStatusType.ACTIVE
  }

  isSuspended(): boolean {
    return this.value === SubscriptionStatusType.SUSPENDED
  }

  isCancelled(): boolean {
    return this.value === SubscriptionStatusType.CANCELLED
  }

  isDisabled(): boolean {
    return this.value === SubscriptionStatusType.DISABLED
  }

  isTrial(): boolean {
    return this.value === SubscriptionStatusType.TRIAL
  }

  isPaused(): boolean {
    return this.value === SubscriptionStatusType.PAUSED
  }

  isInactive(): boolean {
    return this.value === SubscriptionStatusType.INACTIVE
  }

  isExpired(): boolean {
    return this.value === SubscriptionStatusType.EXPIRED
  }

  canRenew(): boolean {
    return this.isActive() || this.isSuspended()
  }

  canCancel(): boolean {
    return this.isActive() || this.isSuspended()
  }

  protected validate(): void {
    if (!Object.values(SubscriptionStatusType).includes(this.value)) {
      throw new Error(`Invalid subscription status: ${this.value}`)
    }
  }
}
