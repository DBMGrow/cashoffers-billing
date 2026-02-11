import { ILogger } from "@/infrastructure/logging/logger.interface"
import { ISubscriptionRepository } from "@/infrastructure/database/repositories/subscription.repository.interface"
import { IEmailService } from "@/infrastructure/email/email-service.interface"
import { IUserApiClient } from "@/infrastructure/external-api/user-api.interface"
import { IEventBus } from "@/infrastructure/events/event-bus.interface"
import { ICancelOnRenewalUseCase } from "./cancel-on-renewal.use-case.interface"
import { CancelOnRenewalInput, CancelOnRenewalOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { CancelOnRenewalInputSchema } from "../types/validation.schemas"
import { SubscriptionCancelledEvent } from "@/domain/events/subscription-cancelled.event"

interface Dependencies {
  logger: ILogger
  subscriptionRepository: ISubscriptionRepository
  emailService: IEmailService
  userApiClient: IUserApiClient
  eventBus: IEventBus
}

/**
 * CancelOnRenewalUseCase
 *
 * Marks or unmarks a subscription for cancellation on renewal with:
 * - Input validation
 * - Subscription lookup
 * - cancel_on_renewal flag update
 * - Email notification (when marking for cancellation)
 */
export class CancelOnRenewalUseCase implements ICancelOnRenewalUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: CancelOnRenewalInput): Promise<UseCaseResult<CancelOnRenewalOutput>> {
    const { logger, subscriptionRepository, userApiClient, eventBus } = this.deps
    const startTime = Date.now()

    try {
      // Validate input
      const validationResult = CancelOnRenewalInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Cancel on renewal validation failed", { errors, input })
        return failure(errors, "CANCEL_ON_RENEWAL_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data
      logger.info("Updating cancel_on_renewal flag", {
        subscriptionId: validatedInput.subscriptionId,
        cancel: validatedInput.cancel,
      })

      // Find subscription
      const subscription = await subscriptionRepository.findById(validatedInput.subscriptionId)
      if (!subscription) {
        logger.warn("Subscription not found", { subscriptionId: validatedInput.subscriptionId })
        return failure("Subscription not found", "SUBSCRIPTION_NOT_FOUND")
      }

      // Update cancel_on_renewal flag (convert boolean to number for database)
      const now = new Date()
      const updated = await subscriptionRepository.update(validatedInput.subscriptionId, {
        cancel_on_renewal: validatedInput.cancel ? 1 : 0,
        updatedAt: now,
      })

      // Publish SubscriptionCancelledEvent when marking for cancellation
      if (validatedInput.cancel) {
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
          SubscriptionCancelledEvent.create({
            subscriptionId: subscription.subscription_id,
            userId: subscription.user_id,
            email: userEmail,
            subscriptionName: subscription.subscription_name || undefined,
            reason: 'user_request',
            cancelledBy: 'user',
            effectiveDate: subscription.renewal_date ? new Date(subscription.renewal_date) : undefined,
            cancelOnRenewal: true,
          })
        )
      }

      logger.info("Cancel on renewal flag updated successfully", {
        subscriptionId: validatedInput.subscriptionId,
        cancelOnRenewal: validatedInput.cancel,
        duration: Date.now() - startTime,
      })

      return success({
        subscriptionId: updated.subscription_id,
        cancelOnRenewal: updated.cancel_on_renewal === 1,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Cancel on renewal error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      return failure(errorMessage, "CANCEL_ON_RENEWAL_ERROR")
    }
  }
}
