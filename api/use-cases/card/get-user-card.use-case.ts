import { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { UserCardRepository } from "@api/lib/repositories"
import { IGetUserCardUseCase } from "./get-user-card.use-case.interface"
import { GetUserCardInput, GetUserCardOutput } from "../types/card.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { GetUserCardInputSchema } from "../types/validation.schemas"

interface Dependencies {
  logger: ILogger
  userCardRepository: UserCardRepository
}

/**
 * GetUserCardUseCase
 *
 * Retrieves a user's card with:
 * - Input validation
 * - User card lookup
 * - Error handling for missing cards
 */
export class GetUserCardUseCase implements IGetUserCardUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: GetUserCardInput): Promise<UseCaseResult<GetUserCardOutput>> {
    const { logger, userCardRepository } = this.deps
    const startTime = Date.now()

    try {
      // Validate input
      const validationResult = GetUserCardInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Get user card validation failed", { errors, input })
        return failure(errors, "GET_USER_CARD_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data
      const { userId } = validatedInput

      logger.info("Getting user card", { userId })

      // Get card from repository
      const cards = await userCardRepository.findByUserId(userId)

      if (cards.length === 0) {
        logger.warn("No card found for user", { userId })
        return failure("No card found", "CARD_NOT_FOUND")
      }

      const card = cards[0]

      logger.info("User card retrieved successfully", {
        userId,
        cardId: card.card_id,
        duration: Date.now() - startTime,
      })

      return success({
        id: card.id,
        userId: card.user_id,
        cardId: card.card_id,
        last4: card.last_4,
        cardBrand: card.card_brand,
        expMonth: card.exp_month,
        expYear: card.exp_year,
        cardholderName: card.cardholder_name,
        squareCustomerId: card.square_customer_id,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Get user card error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      return failure(errorMessage, "GET_USER_CARD_ERROR")
    }
  }
}
