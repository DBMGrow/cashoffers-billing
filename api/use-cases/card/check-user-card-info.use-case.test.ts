import { describe, it, expect, beforeEach } from "vitest"
import { CheckUserCardInfoUseCase } from "./check-user-card-info.use-case"
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

describe("CheckUserCardInfoUseCase", () => {
  let useCase: CheckUserCardInfoUseCase
  let userCardRepo: MockUserCardRepository

  beforeEach(() => {
    userCardRepo = new MockUserCardRepository()

    useCase = new CheckUserCardInfoUseCase({
      logger: new ConsoleLogger(),
      userCardRepository: userCardRepo as any,
    })
  })

  describe("Input Validation", () => {
    it("should fail with invalid userId (zero)", async () => {
      const result = await useCase.execute({ userId: 0 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("CHECK_USER_CARD_INFO_VALIDATION_ERROR")
      }
    })

    it("should fail with negative userId", async () => {
      const result = await useCase.execute({ userId: -1 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("CHECK_USER_CARD_INFO_VALIDATION_ERROR")
      }
    })
  })

  describe("User Has No Card", () => {
    it("should return hasCard=false when user has no cards", async () => {
      const result = await useCase.execute({ userId: 10 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.hasCard).toBe(false)
        expect(result.data.card).toBeUndefined()
      }
    })
  })

  describe("User Has a Card", () => {
    beforeEach(() => {
      userCardRepo.addCard(10, {
        id: 1,
        card_id: "card_abc123",
        square_customer_id: "cust_xyz",
        last_4: "4242",
        card_brand: "VISA",
        exp_month: "12",
        exp_year: "2027",
        cardholder_name: "John Doe",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    })

    it("should return hasCard=true", async () => {
      const result = await useCase.execute({ userId: 10 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.hasCard).toBe(true)
      }
    })

    it("should return the full card object", async () => {
      const result = await useCase.execute({ userId: 10 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.card).toBeDefined()
        expect(result.data.card?.card_id).toBe("card_abc123")
        expect(result.data.card?.last_4).toBe("4242")
        expect(result.data.card?.card_brand).toBe("VISA")
      }
    })

    it("should return the first card when user has multiple", async () => {
      userCardRepo.addCard(10, {
        id: 2,
        card_id: "card_second",
        last_4: "1111",
        card_brand: "MASTERCARD",
      })

      const result = await useCase.execute({ userId: 10 })

      expect(result.success).toBe(true)
      if (result.success) {
        // Should return the first card
        expect(result.data.card?.card_id).toBe("card_abc123")
      }
    })
  })
})
