import { ValueObject } from "../base/value-object.interface"

/**
 * Subscription Status Value Object
 * Represents the state of a subscription
 */
export enum SubscriptionStatusType {
  ACTIVE = "active",
  SUSPENDED = "suspend",
  CANCELLED = "cancel",
  DISABLED = "disabled",
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

  static fromString(status: string): SubscriptionStatus {
    switch (status.toLowerCase()) {
      case "active":
        return SubscriptionStatus.active()
      case "suspend":
        return SubscriptionStatus.suspended()
      case "cancel":
        return SubscriptionStatus.cancelled()
      case "disabled":
        return SubscriptionStatus.disabled()
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
