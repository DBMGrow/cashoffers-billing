import { ILogger } from "@/infrastructure/logging/logger.interface"
import { ISubscriptionRepository } from "@/infrastructure/database/repositories/subscription.repository.interface"
import { IEmailService } from "@/infrastructure/email/email-service.interface"
import { IUserApiClient } from "@/infrastructure/external-api/user-api.interface"
import { ICancelOnRenewalUseCase } from "./cancel-on-renewal.use-case.interface"
import { CancelOnRenewalInput, CancelOnRenewalOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { CancelOnRenewalInputSchema } from "../types/validation.schemas"

interface Dependencies {
  logger: ILogger
  subscriptionRepository: ISubscriptionRepository
  emailService: IEmailService
  userApiClient: IUserApiClient
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
    const { logger, subscriptionRepository, emailService, userApiClient } = this.deps
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

      // Send email notification when marking for cancellation
      if (validatedInput.cancel) {
        try {
          const user = await userApiClient.getUser(subscription.user_id)
          if (user?.email) {
            // Send to admin
            await emailService.sendEmail({
              to: "annette@remrktco.com",
              subject: "User Subscription Cancellation",
              template: "subscriptionCancelled.html",
              fields: {
                name: user?.first_name || user?.last_name || "Unknown",
                email: user.email,
              },
            })
          }
        } catch (emailError) {
          // Don't fail if email fails
          logger.warn("Failed to send cancellation email", { error: emailError })
        }
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
