import { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { SubscriptionRepository } from "@api/lib/repositories"
import type { TransactionRepository } from "@api/lib/repositories"
import { IEmailService } from "@api/infrastructure/email/email-service.interface"
import { IUserApiClient } from "@api/infrastructure/external-api/user-api.interface"
import { IEventBus } from "@api/infrastructure/events/event-bus.interface"
import { IPauseSubscriptionUseCase } from "./pause-subscription.use-case.interface"
import { PauseSubscriptionInput, PauseSubscriptionOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { PauseSubscriptionInputSchema } from "../types/validation.schemas"
import { SubscriptionPausedEvent } from "@api/domain/events/subscription-paused.event"

interface Dependencies {
  logger: ILogger
  subscriptionRepository: SubscriptionRepository
  transactionRepository: TransactionRepository
  emailService: IEmailService
  userApiClient: IUserApiClient
  eventBus: IEventBus
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
        })
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
