import { ILogger } from "@/infrastructure/logging/logger.interface"
import { ISubscriptionRepository } from "@/infrastructure/database/repositories/subscription.repository.interface"
import { IEmailService } from "@/infrastructure/email/email-service.interface"
import { IUserApiClient } from "@/infrastructure/external-api/user-api.interface"
import { IMarkForDowngradeUseCase } from "./mark-for-downgrade.use-case.interface"
import { MarkForDowngradeInput, MarkForDowngradeOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { MarkForDowngradeInputSchema } from "../types/validation.schemas"

interface Dependencies {
  logger: ILogger
  subscriptionRepository: ISubscriptionRepository
  emailService: IEmailService
  userApiClient: IUserApiClient
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
    const { logger, subscriptionRepository, emailService, userApiClient } = this.deps
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

      // Send email notification when marking for downgrade
      if (validatedInput.downgrade) {
        try {
          const user = await userApiClient.getUser(subscription.user_id)
          if (user?.email) {
            // Send to admin
            await emailService.sendEmail({
              to: "annette@remrktco.com",
              subject: "User Subscription Downgrade",
              template: "subscriptionDowngraded.html",
              fields: {
                name: user?.first_name || user?.last_name || "Unknown",
                email: user.email,
              },
            })
          }
        } catch (emailError) {
          // Don't fail if email fails
          logger.warn("Failed to send downgrade email", { error: emailError })
        }
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
