import { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { SubscriptionRepository } from "@api/lib/repositories"
import type { WhitelabelRepository } from "@api/lib/repositories"
import { IEmailService } from "@api/infrastructure/email/email-service.interface"
import { IUserApiClient } from "@api/infrastructure/external-api/user-api.interface"
import { IEventBus } from "@api/infrastructure/events/event-bus.interface"
import { ICancelOnRenewalUseCase } from "./cancel-on-renewal.use-case.interface"
import { CancelOnRenewalInput, CancelOnRenewalOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { CancelOnRenewalInputSchema } from "../types/validation.schemas"
import { SubscriptionCancelledEvent } from "@api/domain/events/subscription-cancelled.event"
import type { SubscriptionData } from "@api/domain/types/product-data.types"

interface Dependencies {
  logger: ILogger
  subscriptionRepository: SubscriptionRepository
  emailService: IEmailService
  userApiClient: IUserApiClient
  eventBus: IEventBus
  whitelabelRepository?: WhitelabelRepository
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

        // Resolve suspension strategy and product data for event metadata
        const metadata = await this.buildSuspensionMetadata(subscription)

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
          }, metadata)
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
