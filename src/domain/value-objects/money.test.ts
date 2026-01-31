import { describe, it, expect } from "vitest"
import { Money } from "./money"

describe("Money", () => {
  describe("Creation", () => {
    it("should create from cents", () => {
      const money = Money.fromCents(5000)
      expect(money.cents).toBe(5000)
      expect(money.dollars).toBe(50)
    })

    it("should create from dollars", () => {
      const money = Money.fromDollars(50.99)
      expect(money.cents).toBe(5099)
      expect(money.dollars).toBe(50.99)
    })

    it("should round cents when creating from dollars", () => {
      const money = Money.fromDollars(50.995)
      expect(money.cents).toBe(5100) // Rounds to nearest cent
    })

    it("should throw error for invalid amount", () => {
      expect(() => Money.fromCents(NaN)).toThrow("Money amount must be a valid number")
    })

    it("should throw error for non-integer cents", () => {
      expect(() => Money.fromCents(50.5)).toThrow("Money amount must be an integer")
    })
  })

  describe("Operations", () => {
    it("should add two money amounts", () => {
      const money1 = Money.fromCents(5000)
      const money2 = Money.fromCents(2500)
      const result = money1.add(money2)

      expect(result.cents).toBe(7500)
    })

    it("should subtract two money amounts", () => {
      const money1 = Money.fromCents(5000)
      const money2 = Money.fromCents(2500)
      const result = money1.subtract(money2)

      expect(result.cents).toBe(2500)
    })

    it("should multiply by a factor", () => {
      const money = Money.fromCents(5000)
      const result = money.multiply(2)

      expect(result.cents).toBe(10000)
    })

    it("should round when multiplying by decimal", () => {
      const money = Money.fromCents(5000)
      const result = money.multiply(0.5)

      expect(result.cents).toBe(2500)
    })
  })

  describe("Predicates", () => {
    it("should identify zero amount", () => {
      const money = Money.fromCents(0)
      expect(money.isZero()).toBe(true)
      expect(money.isPositive()).toBe(false)
      expect(money.isNegative()).toBe(false)
    })

    it("should identify positive amount", () => {
      const money = Money.fromCents(100)
      expect(money.isPositive()).toBe(true)
      expect(money.isZero()).toBe(false)
      expect(money.isNegative()).toBe(false)
    })

    it("should identify negative amount", () => {
      const money = Money.fromCents(-100)
      expect(money.isNegative()).toBe(true)
      expect(money.isZero()).toBe(false)
      expect(money.isPositive()).toBe(false)
    })
  })

  describe("Formatting", () => {
    it("should format as currency", () => {
      const money = Money.fromCents(5099)
      expect(money.format()).toBe("$50.99")
    })

    it("should format zero as currency", () => {
      const money = Money.fromCents(0)
      expect(money.format()).toBe("$0.00")
    })

    it("should format negative as currency", () => {
      const money = Money.fromCents(-5099)
      expect(money.format()).toBe("$-50.99")
    })

    it("should convert to string", () => {
      const money = Money.fromCents(5000)
      expect(money.toString()).toBe("5000")
    })
  })

  describe("Equality", () => {
    it("should be equal to another money with same value", () => {
      const money1 = Money.fromCents(5000)
      const money2 = Money.fromCents(5000)
      expect(money1.equals(money2)).toBe(true)
    })

    it("should not be equal to another money with different value", () => {
      const money1 = Money.fromCents(5000)
      const money2 = Money.fromCents(2500)
      expect(money1.equals(money2)).toBe(false)
    })
  })
})
