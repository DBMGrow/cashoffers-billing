import { ILogger } from "@/infrastructure/logging/logger.interface"
import { ISubscriptionRepository } from "@/infrastructure/database/repositories/subscription.repository.interface"
import { IDeactivateSubscriptionUseCase } from "./deactivate-subscription.use-case.interface"
import { DeactivateSubscriptionInput, DeactivateSubscriptionOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { DeactivateSubscriptionInputSchema } from "../types/validation.schemas"

interface Dependencies {
  logger: ILogger
  subscriptionRepository: ISubscriptionRepository
}

/**
 * DeactivateSubscriptionUseCase
 *
 * Deactivates a user's subscription with:
 * - Input validation
 * - User subscription lookup
 * - Status update to inactive
 * - Error handling for missing subscriptions
 */
export class DeactivateSubscriptionUseCase implements IDeactivateSubscriptionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: DeactivateSubscriptionInput): Promise<UseCaseResult<DeactivateSubscriptionOutput>> {
    const { logger, subscriptionRepository } = this.deps
    const startTime = Date.now()

    try {
      // Validate input
      const validationResult = DeactivateSubscriptionInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Deactivate subscription validation failed", { errors, input })
        return failure(errors, "DEACTIVATE_SUBSCRIPTION_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data
      const { userId } = validatedInput

      logger.info("Deactivating subscription", { userId })

      // Find user's subscription
      const subscriptions = await subscriptionRepository.findByUserId(userId)

      if (subscriptions.length === 0) {
        logger.warn("No subscription found for user", { userId })
        return failure("No subscription found for user", "SUBSCRIPTION_NOT_FOUND")
      }

      const subscription = subscriptions[0]

      // Update subscription status to inactive
      await subscriptionRepository.update(subscription.subscription_id, {
        status: "inactive",
        updatedAt: new Date(),
      })

      logger.info("Subscription deactivated successfully", {
        userId,
        subscriptionId: subscription.subscription_id,
        duration: Date.now() - startTime,
      })

      return success({
        userId,
        status: "inactive",
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Deactivate subscription error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      return failure(errorMessage, "DEACTIVATE_SUBSCRIPTION_ERROR")
    }
  }
}
