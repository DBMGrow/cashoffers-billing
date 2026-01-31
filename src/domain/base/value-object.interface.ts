/**
 * Value Object Interface
 * Value objects are immutable and compared by value, not identity
 */
export interface IValueObject<T> {
  /**
   * Get the underlying value
   */
  readonly value: T

  /**
   * Check if two value objects are equal (based on value)
   */
  equals(other: IValueObject<T>): boolean

  /**
   * Get a string representation of the value object
   */
  toString(): string
}

/**
 * Base abstract value object class
 * Provides common functionality for all value objects
 */
export abstract class ValueObject<T> implements IValueObject<T> {
  constructor(public readonly value: T) {
    this.validate()
  }

  equals(other: IValueObject<T>): boolean {
    if (!other) return false
    if (this === other) return true
    return this.value === other.value
  }

  toString(): string {
    return String(this.value)
  }

  /**
   * Validate the value object
   * Override in subclasses to add specific validation
   */
  protected abstract validate(): void
}
