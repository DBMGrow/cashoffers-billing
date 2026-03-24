import { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { SubscriptionRepository } from "@api/lib/repositories"
import type { WhitelabelRepository } from "@api/lib/repositories"
import { IUserApiClient } from "@api/infrastructure/external-api/user-api.interface"
import { IEventBus } from "@api/infrastructure/events/event-bus.interface"
import { IDeactivateSubscriptionUseCase } from "./deactivate-subscription.use-case.interface"
import { DeactivateSubscriptionInput, DeactivateSubscriptionOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { DeactivateSubscriptionInputSchema } from "../types/validation.schemas"
import { SubscriptionDeactivatedEvent } from "@api/domain/events/subscription-deactivated.event"
import type { SubscriptionData } from "@api/domain/types/product-data.types"

interface Dependencies {
  logger: ILogger
  subscriptionRepository: SubscriptionRepository
  userApiClient: IUserApiClient
  eventBus: IEventBus
  whitelabelRepository?: WhitelabelRepository
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

  private async buildSuspensionMetadata(subscription: any): Promise<Record<string, unknown>> {
    const metadata: Record<string, unknown> = {}

    try {
      const subData: SubscriptionData = subscription.data
        ? (typeof subscription.data === 'string' ? JSON.parse(subscription.data) : subscription.data)
        : {}
      if (subData.productData) {
        metadata.productData = subData.productData
      }

      const whitelabelId = subData.user_config?.whitelabel_id ?? subData.user_config?.white_label_id
        ?? subData.productData?.cashoffers?.user_config?.whitelabel_id ?? subData.productData?.cashoffers?.user_config?.white_label_id
      if (whitelabelId && this.deps.whitelabelRepository) {
        const behavior = await this.deps.whitelabelRepository.getSuspensionBehavior(whitelabelId)
        if (behavior) {
          metadata.suspensionStrategy = behavior
        }
      }
    } catch {
      this.deps.logger.warn('Failed to extract suspension metadata from subscription data')
    }

    return metadata
  }

  async execute(input: DeactivateSubscriptionInput): Promise<UseCaseResult<DeactivateSubscriptionOutput>> {
    const { logger, subscriptionRepository, userApiClient, eventBus } = this.deps
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
      const previousStatus = subscription.status

      // Get user details for email notification
      let userEmail: string | undefined
      try {
        const user = await userApiClient.getUser(userId)
        userEmail = user?.email
      } catch (error) {
        logger.warn("Failed to fetch user email", { userId, error })
      }

      // Update subscription status to inactive
      await subscriptionRepository.update(subscription.subscription_id, {
        status: "inactive",
        updatedAt: new Date(),
      })

      // Resolve suspension strategy and product data for event metadata
      const metadata = await this.buildSuspensionMetadata(subscription)

      // Publish SubscriptionDeactivatedEvent (triggers premium deactivation and email)
      await eventBus.publish(
        SubscriptionDeactivatedEvent.create({
          subscriptionId: subscription.subscription_id,
          userId,
          email: userEmail,
          subscriptionName: subscription.subscription_name || undefined,
          reason: 'manual',
          deactivatedBy: 'admin',
          previousStatus: previousStatus || undefined,
        }, metadata)
      )

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
