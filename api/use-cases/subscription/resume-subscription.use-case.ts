import { ILogger } from "@/infrastructure/logging/logger.interface"
import { ISubscriptionRepository } from "@/infrastructure/database/repositories/subscription.repository.interface"
import { ITransactionRepository } from "@/infrastructure/database/repositories/transaction.repository.interface"
import { IResumeSubscriptionUseCase } from "./resume-subscription.use-case.interface"
import { ResumeSubscriptionInput, ResumeSubscriptionOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { ResumeSubscriptionInputSchema } from "../types/validation.schemas"

interface Dependencies {
  logger: ILogger
  subscriptionRepository: ISubscriptionRepository
  transactionRepository: ITransactionRepository
}

/**
 * ResumeSubscriptionUseCase
 *
 * Resumes a suspended subscription with:
 * - Input validation
 * - Subscription lookup and validation
 * - Status update to "active"
 * - Transaction logging
 */
export class ResumeSubscriptionUseCase implements IResumeSubscriptionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: ResumeSubscriptionInput): Promise<UseCaseResult<ResumeSubscriptionOutput>> {
    const { logger, subscriptionRepository, transactionRepository } = this.deps
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
      if (subscription.status !== "suspended") {
        logger.warn("Cannot resume non-suspended subscription", {
          subscriptionId: validatedInput.subscriptionId,
          status: subscription.status,
        })
        return failure("Only suspended subscriptions can be resumed", "INVALID_STATUS")
      }

      // Update subscription status
      const now = new Date()
      const updated = await subscriptionRepository.update(validatedInput.subscriptionId, {
        status: "active",
        updatedAt: now,
      })

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

      logger.info("Subscription resumed successfully", {
        subscriptionId: validatedInput.subscriptionId,
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
