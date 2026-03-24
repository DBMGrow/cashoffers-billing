import { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { SubscriptionRepository } from "@api/lib/repositories"
import type { TransactionRepository } from "@api/lib/repositories"
import type { WhitelabelRepository } from "@api/lib/repositories"
import { IEmailService } from "@api/infrastructure/email/email-service.interface"
import { IUserApiClient } from "@api/infrastructure/external-api/user-api.interface"
import { IEventBus } from "@api/infrastructure/events/event-bus.interface"
import { IPauseSubscriptionUseCase } from "./pause-subscription.use-case.interface"
import { PauseSubscriptionInput, PauseSubscriptionOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { PauseSubscriptionInputSchema } from "../types/validation.schemas"
import { SubscriptionPausedEvent } from "@api/domain/events/subscription-paused.event"
import type { ProductData, SubscriptionData } from "@api/domain/types/product-data.types"

interface Dependencies {
  logger: ILogger
  subscriptionRepository: SubscriptionRepository
  transactionRepository: TransactionRepository
  emailService: IEmailService
  userApiClient: IUserApiClient
  eventBus: IEventBus
  whitelabelRepository?: WhitelabelRepository
}

/**
 * PauseSubscriptionUseCase
 *
 * Pauses (suspends) a subscription with:
 * - Input validation
 * - Subscription lookup and validation
 * - Status update to "suspended"
 * - Transaction logging
 * - Email notification
 */
export class PauseSubscriptionUseCase implements IPauseSubscriptionUseCase {
  constructor(private readonly deps: Dependencies) {}

  private async buildSuspensionMetadata(subscription: any): Promise<Record<string, unknown>> {
    const metadata: Record<string, unknown> = {}

    // Extract productData from subscription.data
    try {
      const subData: SubscriptionData = subscription.data
        ? (typeof subscription.data === 'string' ? JSON.parse(subscription.data) : subscription.data)
        : {}
      if (subData.productData) {
        metadata.productData = subData.productData
      }

      // Resolve suspension strategy from whitelabel
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

  async execute(input: PauseSubscriptionInput): Promise<UseCaseResult<PauseSubscriptionOutput>> {
    const { logger, subscriptionRepository, transactionRepository, userApiClient, eventBus } = this.deps
    const startTime = Date.now()

    try {
      // Validate input
      const validationResult = PauseSubscriptionInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Pause subscription validation failed", { errors, input })
        return failure(errors, "PAUSE_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data
      logger.info("Pausing subscription", { subscriptionId: validatedInput.subscriptionId })

      // Find subscription
      const subscription = await subscriptionRepository.findById(validatedInput.subscriptionId)
      if (!subscription) {
        logger.warn("Subscription not found", { subscriptionId: validatedInput.subscriptionId })
        return failure("Subscription not found", "SUBSCRIPTION_NOT_FOUND")
      }

      // Check if subscription can be paused
      if (subscription.status !== "active") {
        logger.warn("Cannot pause non-active subscription", {
          subscriptionId: validatedInput.subscriptionId,
          status: subscription.status,
        })
        return failure("Only active subscriptions can be paused", "INVALID_STATUS")
      }

      // Update subscription status
      const now = new Date()
      const updated = await subscriptionRepository.update(validatedInput.subscriptionId, {
        status: "suspended",
        suspension_date: now,
        updatedAt: now,
      })

      // Log transaction
      await transactionRepository.create({
        user_id: subscription.user_id,
        amount: 0,
        type: "subscription",
        memo: "Subscription paused",
        status: "completed",
        data: JSON.stringify({ subscriptionId: validatedInput.subscriptionId }),
        createdAt: now,
        updatedAt: now,
      })

      // Get user email for event notification
      let userEmail: string | undefined
      try {
        const user = await userApiClient.getUser(subscription.user_id)
        userEmail = user?.email
      } catch (error) {
        logger.warn("Failed to fetch user email", { userId: subscription.user_id, error })
      }

      // Resolve suspension strategy and product data for event metadata
      const metadata = await this.buildSuspensionMetadata(subscription)

      // Publish SubscriptionPausedEvent (triggers email and premium deactivation)
      await eventBus.publish(
        SubscriptionPausedEvent.create({
          subscriptionId: subscription.subscription_id,
          userId: subscription.user_id,
          email: userEmail,
          subscriptionName: subscription.subscription_name || undefined,
          reason: 'user_request',
          pausedBy: 'user',
          previousStatus: 'active',
        }, metadata)
      )

      logger.info("Subscription paused successfully", {
        subscriptionId: validatedInput.subscriptionId,
        duration: Date.now() - startTime,
      })

      return success({
        subscriptionId: updated.subscription_id,
        status: updated.status || "suspended",
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Pause subscription error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      return failure(errorMessage, "PAUSE_SUBSCRIPTION_ERROR")
    }
  }
}
