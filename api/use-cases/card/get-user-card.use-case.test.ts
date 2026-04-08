import { describe, it, expect, beforeEach } from "vitest"
import { GetUserCardUseCase } from "./get-user-card.use-case"
import { ConsoleLogger } from "@api/infrastructure/logging/console.logger"

class MockUserCardRepository {
  private cards = new Map<number, any[]>()

  async findByUserId(userId: number) {
    return this.cards.get(userId) || []
  }

  async findById(id: number) {
    for (const cards of this.cards.values()) {
      const found = cards.find((c) => c.id === id)
      if (found) return found
    }
    return null
  }

  async create(data: any) {
    const card = { id: Date.now(), ...data }
    const existing = this.cards.get(data.user_id) || []
    this.cards.set(data.user_id, [...existing, card])
    return card
  }

  async update(id: number, data: any) {
    return { id, ...data }
  }

  async delete(): Promise<void> {}

  addCard(userId: number, card: any) {
    const existing = this.cards.get(userId) || []
    this.cards.set(userId, [...existing, { user_id: userId, ...card }])
  }
}

describe("GetUserCardUseCase", () => {
  let useCase: GetUserCardUseCase
  let userCardRepo: MockUserCardRepository

  beforeEach(() => {
    userCardRepo = new MockUserCardRepository()

    useCase = new GetUserCardUseCase({
      logger: new ConsoleLogger(),
      userCardRepository: userCardRepo as any,
    })
  })

  describe("Input Validation", () => {
    it("should fail with invalid userId (zero)", async () => {
      const result = await useCase.execute({ userId: 0 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("GET_USER_CARD_VALIDATION_ERROR")
      }
    })

    it("should fail with negative userId", async () => {
      const result = await useCase.execute({ userId: -1 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("GET_USER_CARD_VALIDATION_ERROR")
      }
    })
  })

  describe("Card Not Found", () => {
    it("should fail when user has no cards", async () => {
      const result = await useCase.execute({ userId: 10 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe("No card found")
        expect(result.code).toBe("CARD_NOT_FOUND")
      }
    })
  })

  describe("Card Found", () => {
    const testCard = {
      id: 1,
      card_id: "card_abc123",
      square_customer_id: "cust_xyz",
      last_4: "4242",
      card_brand: "VISA",
      exp_month: "12",
      exp_year: "2027",
      cardholder_name: "Jane Smith",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    }

    beforeEach(() => {
      userCardRepo.addCard(10, testCard)
    })

    it("should return success with card data", async () => {
      const result = await useCase.execute({ userId: 10 })

      expect(result.success).toBe(true)
    })

    it("should return mapped card fields", async () => {
      const result = await useCase.execute({ userId: 10 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.cardId).toBe("card_abc123")
        expect(result.data.userId).toBe(10)
        expect(result.data.last4).toBe("4242")
        expect(result.data.cardBrand).toBe("VISA")
        expect(result.data.expMonth).toBe("12")
        expect(result.data.expYear).toBe("2027")
        expect(result.data.cardholderName).toBe("Jane Smith")
        expect(result.data.squareCustomerId).toBe("cust_xyz")
      }
    })

    it("should return the first card when user has multiple", async () => {
      userCardRepo.addCard(10, {
        id: 2,
        card_id: "card_second",
        last_4: "9999",
        card_brand: "MASTERCARD",
      })

      const result = await useCase.execute({ userId: 10 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.cardId).toBe("card_abc123")
      }
    })
  })
})
