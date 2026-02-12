import { ILogger } from "@api/infrastructure/logging/logger.interface"
import { ISubscriptionRepository } from "@api/infrastructure/database/repositories/subscription.repository.interface"
import { IEmailService } from "@api/infrastructure/email/email-service.interface"
import { IUserApiClient } from "@api/infrastructure/external-api/user-api.interface"
import { IEventBus } from "@api/infrastructure/events/event-bus.interface"
import { IMarkForDowngradeUseCase } from "./mark-for-downgrade.use-case.interface"
import { MarkForDowngradeInput, MarkForDowngradeOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { MarkForDowngradeInputSchema } from "../types/validation.schemas"
import { SubscriptionDowngradedEvent } from "@api/domain/events/subscription-downgraded.event"

interface Dependencies {
  logger: ILogger
  subscriptionRepository: ISubscriptionRepository
  emailService: IEmailService
  userApiClient: IUserApiClient
  eventBus: IEventBus
}

/**
 * MarkForDowngradeUseCase
 *
 * Marks or unmarks a subscription for downgrade on renewal with:
 * - Input validation
 * - Subscription lookup
 * - downgrade_on_renewal flag update
 * - Email notification (when marking for downgrade)
 */
export class MarkForDowngradeUseCase implements IMarkForDowngradeUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: MarkForDowngradeInput): Promise<UseCaseResult<MarkForDowngradeOutput>> {
    const { logger, subscriptionRepository, userApiClient, eventBus } = this.deps
    const startTime = Date.now()

    try {
      // Validate input
      const validationResult = MarkForDowngradeInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Mark for downgrade validation failed", { errors, input })
        return failure(errors, "MARK_FOR_DOWNGRADE_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data
      logger.info("Updating downgrade_on_renewal flag", {
        subscriptionId: validatedInput.subscriptionId,
        downgrade: validatedInput.downgrade,
      })

      // Find subscription
      const subscription = await subscriptionRepository.findById(validatedInput.subscriptionId)
      if (!subscription) {
        logger.warn("Subscription not found", { subscriptionId: validatedInput.subscriptionId })
        return failure("Subscription not found", "SUBSCRIPTION_NOT_FOUND")
      }

      // Update downgrade_on_renewal flag (convert boolean to number for database)
      const now = new Date()
      const updated = await subscriptionRepository.update(validatedInput.subscriptionId, {
        downgrade_on_renewal: validatedInput.downgrade ? 1 : 0,
        updatedAt: now,
      })

      // Publish SubscriptionDowngradedEvent when marking for downgrade
      if (validatedInput.downgrade) {
        // Get user email for event notification
        let userEmail: string | undefined
        try {
          const user = await userApiClient.getUser(subscription.user_id)
          userEmail = user?.email
        } catch (error) {
          logger.warn("Failed to fetch user email", { userId: subscription.user_id, error })
        }

        // Publish event (triggers email notifications to user and admin)
        await eventBus.publish(
          SubscriptionDowngradedEvent.create({
            subscriptionId: subscription.subscription_id,
            userId: subscription.user_id,
            email: userEmail,
            currentSubscriptionName: subscription.subscription_name || undefined,
            reason: 'user_request',
            downgradedBy: 'user',
            effectiveDate: subscription.renewal_date ? new Date(subscription.renewal_date) : undefined,
            downgradeOnRenewal: true,
          })
        )
      }

      logger.info("Downgrade on renewal flag updated successfully", {
        subscriptionId: validatedInput.subscriptionId,
        downgradeOnRenewal: validatedInput.downgrade,
        duration: Date.now() - startTime,
      })

      return success({
        subscriptionId: updated.subscription_id,
        downgradeOnRenewal: updated.downgrade_on_renewal === 1,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Mark for downgrade error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      return failure(errorMessage, "MARK_FOR_DOWNGRADE_ERROR")
    }
  }
}
