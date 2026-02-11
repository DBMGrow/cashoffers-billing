import { ValueObject } from "../base/value-object.interface"

/**
 * Money Value Object
 * Represents monetary amounts in cents (to avoid floating point issues)
 */
export class Money extends ValueObject<number> {
  private constructor(value: number) {
    super(value)
  }

  /**
   * Create Money from cents
   */
  static fromCents(cents: number): Money {
    return new Money(cents)
  }

  /**
   * Create Money from dollars
   */
  static fromDollars(dollars: number): Money {
    return new Money(Math.round(dollars * 100))
  }

  /**
   * Get amount in cents
   */
  get cents(): number {
    return this.value
  }

  /**
   * Get amount in dollars
   */
  get dollars(): number {
    return this.value / 100
  }

  /**
   * Add two money amounts
   */
  add(other: Money): Money {
    return Money.fromCents(this.value + other.value)
  }

  /**
   * Subtract two money amounts
   */
  subtract(other: Money): Money {
    return Money.fromCents(this.value - other.value)
  }

  /**
   * Multiply by a factor
   */
  multiply(factor: number): Money {
    return Money.fromCents(Math.round(this.value * factor))
  }

  /**
   * Check if amount is zero
   */
  isZero(): boolean {
    return this.value === 0
  }

  /**
   * Check if amount is positive
   */
  isPositive(): boolean {
    return this.value > 0
  }

  /**
   * Check if amount is negative
   */
  isNegative(): boolean {
    return this.value < 0
  }

  /**
   * Format as currency string
   */
  format(): string {
    return `$${this.dollars.toFixed(2)}`
  }

  protected validate(): void {
    if (typeof this.value !== "number" || isNaN(this.value)) {
      throw new Error("Money amount must be a valid number")
    }
    if (!Number.isInteger(this.value)) {
      throw new Error("Money amount must be an integer (cents)")
    }
  }
}
