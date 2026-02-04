import { ILogger } from "@/infrastructure/logging/logger.interface"
import { ISubscriptionRepository } from "@/infrastructure/database/repositories/subscription.repository.interface"
import { ITransactionRepository } from "@/infrastructure/database/repositories/transaction.repository.interface"
import { IUpdateSubscriptionFieldsUseCase } from "./update-subscription-fields.use-case.interface"
import { UpdateSubscriptionFieldsInput, UpdateSubscriptionFieldsOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { UpdateSubscriptionFieldsInputSchema } from "../types/validation.schemas"

interface Dependencies {
  logger: ILogger
  subscriptionRepository: ISubscriptionRepository
  transactionRepository: ITransactionRepository
}

/**
 * UpdateSubscriptionFieldsUseCase
 *
 * Updates subscription fields with:
 * - Input validation
 * - Subscription lookup and validation
 * - Field updates
 * - Transaction logging
 */
export class UpdateSubscriptionFieldsUseCase implements IUpdateSubscriptionFieldsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: UpdateSubscriptionFieldsInput): Promise<UseCaseResult<UpdateSubscriptionFieldsOutput>> {
    const { logger, subscriptionRepository, transactionRepository } = this.deps
    const startTime = Date.now()

    try {
      // Validate input
      const validationResult = UpdateSubscriptionFieldsInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Update subscription fields validation failed", { errors, input })
        return failure(errors, "UPDATE_SUBSCRIPTION_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data
      logger.info("Updating subscription fields", { subscriptionId: validatedInput.subscriptionId })

      // Find subscription
      const subscription = await subscriptionRepository.findById(validatedInput.subscriptionId)
      if (!subscription) {
        logger.warn("Subscription not found", { subscriptionId: validatedInput.subscriptionId })
        return failure("Subscription not found", "SUBSCRIPTION_NOT_FOUND")
      }

      // Build update object with only provided fields
      const updateData: any = {
        updatedAt: new Date(),
      }

      if (validatedInput.subscriptionName !== undefined) {
        updateData.subscription_name = validatedInput.subscriptionName
      }
      if (validatedInput.amount !== undefined) {
        updateData.amount = validatedInput.amount
      }
      if (validatedInput.duration !== undefined) {
        updateData.duration = validatedInput.duration
      }
      if (validatedInput.status !== undefined) {
        updateData.status = validatedInput.status
      }

      // Update subscription
      await subscriptionRepository.update(validatedInput.subscriptionId, updateData)

      // Log transaction
      const now = new Date()
      await transactionRepository.create({
        user_id: subscription.user_id,
        amount: 0,
        type: "subscription",
        memo: "Subscription updated",
        status: "completed",
        data: JSON.stringify(updateData),
        createdAt: now,
        updatedAt: now,
      })

      logger.info("Subscription fields updated successfully", {
        subscriptionId: validatedInput.subscriptionId,
        duration: Date.now() - startTime,
      })

      return success({
        subscriptionId: subscription.subscription_id,
        updated: true,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Update subscription fields error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      return failure(errorMessage, "UPDATE_SUBSCRIPTION_FIELDS_ERROR")
    }
  }
}
