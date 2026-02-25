import { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { ProductRepository } from "@api/lib/repositories"
import type { SubscriptionRepository } from "@api/lib/repositories"
import { ICalculateProratedUseCase, CalculateProratedInput, CalculateProratedOutput } from "./calculate-prorated.use-case.interface"
import { UseCaseResult, success, failure } from "../base/use-case.interface"

interface Dependencies {
  logger: ILogger
  productRepository: ProductRepository
  subscriptionRepository: SubscriptionRepository
}

/**
 * CalculateProratedUseCase
 *
 * Calculates the prorated charge when upgrading a subscription to a new product.
 * Takes into account:
 * - The cost difference between current and new plans
 * - The time remaining in the current billing period
 * - Never returns a negative prorated amount (no refunds for downgrades)
 */
export class CalculateProratedUseCase implements ICalculateProratedUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: CalculateProratedInput): Promise<UseCaseResult<CalculateProratedOutput>> {
    const { logger } = this.deps

    try {
      logger.info("Calculating prorated amount", {
        productId: input.productId,
        userId: input.userId,
      })

      // Validate input
      if (!input.productId) {
        return failure("product_id is required", "VALIDATION_ERROR")
      }
      if (!input.userId) {
        return failure("user_id is required", "VALIDATION_ERROR")
      }

      // Get the product
      const product = await this.deps.productRepository.findById(input.productId)
      if (!product) {
        return failure("Product not found", "PRODUCT_NOT_FOUND")
      }

      // Get the user's active subscription
      const subscriptions = await this.deps.subscriptionRepository.findActiveByUserId(input.userId)
      if (!subscriptions || subscriptions.length === 0) {
        return failure("No active subscription found", "SUBSCRIPTION_NOT_FOUND")
      }

      const subscription = subscriptions[0]

      // Extract renewal costs from data field
      const currentPlanCost = (subscription.data as any)?.renewal_cost
      const newPlanCost = (product.data as any)?.renewal_cost

      if (!currentPlanCost) {
        return failure("Current plan cost not found", "INVALID_SUBSCRIPTION_DATA")
      }
      if (!newPlanCost) {
        return failure("New plan cost not found", "INVALID_PRODUCT_DATA")
      }

      const renewalDate = new Date(subscription.renewal_date)
      const duration = subscription.duration

      if (!renewalDate) {
        return failure("Renewal date not found", "INVALID_SUBSCRIPTION_DATA")
      }
      if (!duration) {
        return failure("Duration not found", "INVALID_SUBSCRIPTION_DATA")
      }

      // Calculate start date based on renewal date and duration
      const startDate = new Date(renewalDate)
      if (duration === "daily") startDate.setDate(startDate.getDate() - 1)
      if (duration === "weekly") startDate.setDate(startDate.getDate() - 7)
      if (duration === "monthly") startDate.setMonth(startDate.getMonth() - 1)
      if (duration === "yearly") startDate.setFullYear(startDate.getFullYear() - 1)

      // Calculate time metrics
      const totalDuration = Math.abs(renewalDate.getTime() - startDate.getTime()) / 1000 / 60 / 60 / 24
      const timeRemaining = Math.abs(renewalDate.getTime() - new Date().getTime()) / 1000 / 60 / 60 / 24

      let percentOfTimeRemaining = timeRemaining / totalDuration
      // If renewal date has passed, no time remaining
      if (renewalDate < new Date()) {
        percentOfTimeRemaining = 0
      }

      const totalSubscriptionCostDifference = newPlanCost - currentPlanCost

      // We don't set a negative prorated amount (no refunds for downgrades)
      const proratedAmount = Math.floor(
        Math.max(0, totalSubscriptionCostDifference * percentOfTimeRemaining)
      )

      const output: CalculateProratedOutput = {
        proratedAmount,
        startDate,
        renewalDate,
        duration,
        currentPlanCost,
        newPlanCost,
        totalDuration,
        timeRemaining,
        percentOfTimeRemaining,
        totalSubscriptionCostDifference,
      }

      logger.info("Prorated amount calculated", {
        userId: input.userId,
        productId: input.productId,
        proratedAmount,
        currentPlanCost,
        newPlanCost,
      })

      return success(output)
    } catch (error) {
      logger.error("Failed to calculate prorated amount", error, {
        productId: input.productId,
        userId: input.userId,
      })
      return failure(
        error instanceof Error ? error.message : "Unknown error calculating prorated amount",
        "CALCULATION_ERROR"
      )
    }
  }
}
