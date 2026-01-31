import { describe, it, expect } from "vitest"
import { Email } from "./email"

describe("Email", () => {
  describe("Creation", () => {
    it("should create valid email", () => {
      const email = Email.from("user@example.com")
      expect(email.address).toBe("user@example.com")
    })

    it("should normalize to lowercase", () => {
      const email = Email.from("User@Example.COM")
      expect(email.address).toBe("user@example.com")
    })

    it("should trim whitespace", () => {
      const email = Email.from("  user@example.com  ")
      expect(email.address).toBe("user@example.com")
    })

    it("should throw error for empty email", () => {
      expect(() => Email.from("")).toThrow("Email address is required")
    })

    it("should throw error for invalid format", () => {
      expect(() => Email.from("invalid")).toThrow("Invalid email address format")
      expect(() => Email.from("@example.com")).toThrow("Invalid email address format")
      expect(() => Email.from("user@")).toThrow("Invalid email address format")
    })

    it("should throw error for too long email", () => {
      const longEmail = "a".repeat(250) + "@example.com"
      expect(() => Email.from(longEmail)).toThrow("Email address is too long")
    })
  })

  describe("Properties", () => {
    it("should extract local part", () => {
      const email = Email.from("user@example.com")
      expect(email.localPart).toBe("user")
    })

    it("should extract domain", () => {
      const email = Email.from("user@example.com")
      expect(email.domain).toBe("example.com")
    })
  })

  describe("Equality", () => {
    it("should be equal to another email with same address", () => {
      const email1 = Email.from("user@example.com")
      const email2 = Email.from("user@example.com")
      expect(email1.equals(email2)).toBe(true)
    })

    it("should be equal regardless of case", () => {
      const email1 = Email.from("User@Example.com")
      const email2 = Email.from("user@example.com")
      expect(email1.equals(email2)).toBe(true)
    })

    it("should not be equal to different email", () => {
      const email1 = Email.from("user1@example.com")
      const email2 = Email.from("user2@example.com")
      expect(email1.equals(email2)).toBe(false)
    })
  })

  describe("String Representation", () => {
    it("should convert to string", () => {
      const email = Email.from("user@example.com")
      expect(email.toString()).toBe("user@example.com")
    })
  })
})
