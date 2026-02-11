import { ValueObject } from "../base/value-object.interface"

/**
 * Email Value Object
 * Represents a valid email address
 */
export class Email extends ValueObject<string> {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  private constructor(value: string) {
    super(value.toLowerCase().trim())
  }

  /**
   * Create Email from string
   */
  static from(email: string): Email {
    return new Email(email)
  }

  /**
   * Get the email address
   */
  get address(): string {
    return this.value
  }

  /**
   * Get the local part (before @)
   */
  get localPart(): string {
    return this.value.split("@")[0]
  }

  /**
   * Get the domain part (after @)
   */
  get domain(): string {
    return this.value.split("@")[1]
  }

  protected validate(): void {
    if (!this.value || this.value.trim() === "") {
      throw new Error("Email address is required")
    }
    if (!Email.EMAIL_REGEX.test(this.value)) {
      throw new Error("Invalid email address format")
    }
    if (this.value.length > 254) {
      throw new Error("Email address is too long")
    }
  }
}
