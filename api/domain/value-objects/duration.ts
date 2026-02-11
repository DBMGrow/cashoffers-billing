import { ValueObject } from "../base/value-object.interface"

/**
 * Duration Value Object
 * Represents subscription billing duration
 */
export enum DurationType {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  YEARLY = "yearly",
}

export class Duration extends ValueObject<DurationType> {
  private constructor(value: DurationType) {
    super(value)
  }

  static daily(): Duration {
    return new Duration(DurationType.DAILY)
  }

  static weekly(): Duration {
    return new Duration(DurationType.WEEKLY)
  }

  static monthly(): Duration {
    return new Duration(DurationType.MONTHLY)
  }

  static yearly(): Duration {
    return new Duration(DurationType.YEARLY)
  }

  static fromString(duration: string): Duration {
    switch (duration.toLowerCase()) {
      case "daily":
      case "day":
        return Duration.daily()
      case "weekly":
      case "week":
        return Duration.weekly()
      case "monthly":
      case "month":
        return Duration.monthly()
      case "yearly":
      case "year":
        return Duration.yearly()
      default:
        throw new Error(`Invalid duration: ${duration}`)
    }
  }

  /**
   * Calculate next renewal date from a given date
   */
  calculateNextRenewalDate(from: Date): Date {
    const next = new Date(from)

    switch (this.value) {
      case DurationType.DAILY:
        next.setDate(next.getDate() + 1)
        break
      case DurationType.WEEKLY:
        next.setDate(next.getDate() + 7)
        break
      case DurationType.MONTHLY:
        next.setMonth(next.getMonth() + 1)
        break
      case DurationType.YEARLY:
        next.setFullYear(next.getFullYear() + 1)
        break
    }

    return next
  }

  /**
   * Get duration in days (approximate for monthly/yearly)
   */
  getDays(): number {
    switch (this.value) {
      case DurationType.DAILY:
        return 1
      case DurationType.WEEKLY:
        return 7
      case DurationType.MONTHLY:
        return 30
      case DurationType.YEARLY:
        return 365
    }
  }

  protected validate(): void {
    if (!Object.values(DurationType).includes(this.value)) {
      throw new Error(`Invalid duration: ${this.value}`)
    }
  }
}
