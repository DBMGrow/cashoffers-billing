import { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { UserCardRepository } from "@api/lib/repositories"
import { ICheckUserCardInfoUseCase } from "./check-user-card-info.use-case.interface"
import { CheckUserCardInfoInput, CheckUserCardInfoOutput } from "../types/card.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { CheckUserCardInfoInputSchema } from "../types/validation.schemas"

interface Dependencies {
  logger: ILogger
  userCardRepository: UserCardRepository
}

/**
 * CheckUserCardInfoUseCase
 *
 * Checks if a user has a card and returns card info with:
 * - Input validation
 * - User card lookup
 * - Boolean flag for card existence
 * - Full card data if card exists
 */
export class CheckUserCardInfoUseCase implements ICheckUserCardInfoUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: CheckUserCardInfoInput): Promise<UseCaseResult<CheckUserCardInfoOutput>> {
    const { logger, userCardRepository } = this.deps
    const startTime = Date.now()

    try {
      // Validate input
      const validationResult = CheckUserCardInfoInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Check user card info validation failed", { errors, input })
        return failure(errors, "CHECK_USER_CARD_INFO_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data
      const { userId } = validatedInput

      logger.info("Checking user card info", { userId })

      // Get card from repository
      const cards = await userCardRepository.findByUserId(userId)

      if (cards.length === 0) {
        logger.info("No card found for user", { userId })
        return success({
          hasCard: false,
        })
      }

      const card = cards[0]

      logger.info("User card info retrieved successfully", {
        userId,
        hasCard: true,
        duration: Date.now() - startTime,
      })

      return success({
        hasCard: true,
        card,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Check user card info error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      return failure(errorMessage, "CHECK_USER_CARD_INFO_ERROR")
    }
  }
}
