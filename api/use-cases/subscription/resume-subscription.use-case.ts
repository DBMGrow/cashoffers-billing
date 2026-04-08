import { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { SubscriptionRepository } from "@api/lib/repositories"
import type { TransactionRepository } from "@api/lib/repositories"
import { IEventBus } from "@api/infrastructure/events/event-bus.interface"
import { IResumeSubscriptionUseCase } from "./resume-subscription.use-case.interface"
import { ResumeSubscriptionInput, ResumeSubscriptionOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { ResumeSubscriptionInputSchema } from "../types/validation.schemas"
import { SubscriptionResumedEvent } from "@api/domain/events/subscription-resumed.event"

interface Dependencies {
  logger: ILogger
  subscriptionRepository: SubscriptionRepository
  transactionRepository: TransactionRepository
  eventBus?: IEventBus
}

/**
 * ResumeSubscriptionUseCase
 *
 * Resumes a suspended subscription with:
 * - Input validation
 * - Subscription lookup and validation
 * - Renewal date adjustment based on time paused
 * - Status update to "active"
 * - Transaction logging
 * - SubscriptionResumedEvent published
 */
export class ResumeSubscriptionUseCase implements IResumeSubscriptionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: ResumeSubscriptionInput): Promise<UseCaseResult<ResumeSubscriptionOutput>> {
    const { logger, subscriptionRepository, transactionRepository, eventBus } = this.deps
    const startTime = Date.now()

    try {
      // Validate input
      const validationResult = ResumeSubscriptionInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Resume subscription validation failed", { errors, input })
        return failure(errors, "RESUME_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data
      logger.info("Resuming subscription", { subscriptionId: validatedInput.subscriptionId })

      // Find subscription
      const subscription = await subscriptionRepository.findById(validatedInput.subscriptionId)
      if (!subscription) {
        logger.warn("Subscription not found", { subscriptionId: validatedInput.subscriptionId })
        return failure("Subscription not found", "SUBSCRIPTION_NOT_FOUND")
      }

      // Check if subscription can be resumed
      if (subscription.status !== "paused" && subscription.status !== "suspended") {
        logger.warn("Cannot resume non-paused/suspended subscription", {
          subscriptionId: validatedInput.subscriptionId,
          status: subscription.status,
        })
        return failure("Only paused or suspended subscriptions can be resumed", "INVALID_STATUS")
      }

      const now = new Date()

      // Calculate adjusted renewal date if suspension_date is available
      let newRenewalDate: Date | undefined
      if (subscription.suspension_date && subscription.renewal_date) {
        const suspensionDate = new Date(subscription.suspension_date)
        const originalRenewalDate = new Date(subscription.renewal_date)
        const daysRemaining = Math.round(
          (originalRenewalDate.getTime() - suspensionDate.getTime()) / (1000 * 60 * 60 * 24)
        )
        newRenewalDate = new Date(now)
        newRenewalDate.setDate(now.getDate() + daysRemaining)
      }

      // Update subscription status
      const updateData: Record<string, unknown> = {
        status: "active",
        suspension_date: null,
        updatedAt: now,
      }
      if (newRenewalDate) {
        updateData.renewal_date = newRenewalDate
      }

      const updated = await subscriptionRepository.update(validatedInput.subscriptionId, updateData as any)

      // Log transaction
      await transactionRepository.create({
        user_id: subscription.user_id,
        amount: 0,
        type: "subscription",
        memo: "Subscription resumed",
        status: "completed",
        data: JSON.stringify({ subscriptionId: validatedInput.subscriptionId }),
        createdAt: now,
        updatedAt: now,
      })

      // Publish SubscriptionResumedEvent
      if (eventBus && subscription.user_id) {
        await eventBus.publish(
          SubscriptionResumedEvent.create({
            subscriptionId: subscription.subscription_id,
            userId: subscription.user_id,
            newRenewalDate,
          })
        )
      }

      logger.info("Subscription resumed successfully", {
        subscriptionId: validatedInput.subscriptionId,
        newRenewalDate,
        duration: Date.now() - startTime,
      })

      return success({
        subscriptionId: updated.subscription_id,
        status: updated.status || "active",
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Resume subscription error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      return failure(errorMessage, "RESUME_SUBSCRIPTION_ERROR")
    }
  }
}
