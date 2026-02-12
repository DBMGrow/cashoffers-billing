import { ILogger } from "@api/infrastructure/logging/logger.interface"
import { ISubscriptionRepository } from "@api/infrastructure/database/repositories/subscription.repository.interface"
import { IGetSubscriptionsUseCase } from "./get-subscriptions.use-case.interface"
import { GetSubscriptionsInput, GetSubscriptionsOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { GetSubscriptionsInputSchema } from "../types/validation.schemas"

interface Dependencies {
  logger: ILogger
  subscriptionRepository: ISubscriptionRepository
}

/**
 * GetSubscriptionsUseCase
 *
 * Retrieves subscriptions with:
 * - Input validation
 * - Pagination support
 * - User filtering
 */
export class GetSubscriptionsUseCase implements IGetSubscriptionsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: GetSubscriptionsInput): Promise<UseCaseResult<GetSubscriptionsOutput>> {
    const { logger, subscriptionRepository } = this.deps
    const startTime = Date.now()

    try {
      // Validate input with Zod
      const validationResult = GetSubscriptionsInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Get subscriptions validation failed", { errors, input })
        return failure(errors, "GET_SUBSCRIPTIONS_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data

      // Set defaults
      const page = validatedInput.page || 1
      const limit = validatedInput.limit || 20
      const offset = (page - 1) * limit

      logger.info("Retrieving subscriptions", {
        userId: validatedInput.userId,
        page,
        limit,
      })

      // Get subscriptions
      let subscriptions
      let total

      if (validatedInput.userId) {
        // Get for specific user
        const userSubscriptions = await subscriptionRepository.findByUserId(validatedInput.userId)
        subscriptions = userSubscriptions.slice(offset, offset + limit)
        total = userSubscriptions.length
      } else {
        // Get all
        const allSubscriptions = await subscriptionRepository.findAll()
        total = allSubscriptions.length
        subscriptions = allSubscriptions.slice(offset, offset + limit)
      }

      // Map to output format
      const mappedSubscriptions = subscriptions.map((sub) => ({
        subscriptionId: sub.subscription_id,
        userId: sub.user_id,
        subscriptionName: sub.subscription_name,
        amount: sub.amount,
        duration: sub.duration,
        status: sub.status || "unknown",
        renewalDate: sub.renewal_date,
        cancelOnRenewal: sub.cancel_on_renewal === 1,
        downgradeOnRenewal: sub.downgrade_on_renewal === 1,
        createdAt: sub.createdAt,
      }))

      logger.info("Subscriptions retrieved successfully", {
        count: mappedSubscriptions.length,
        total,
        duration: Date.now() - startTime,
      })

      return success({
        subscriptions: mappedSubscriptions,
        total,
        page,
        limit,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Get subscriptions error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      return failure(errorMessage, "GET_SUBSCRIPTIONS_ERROR")
    }
  }
}
