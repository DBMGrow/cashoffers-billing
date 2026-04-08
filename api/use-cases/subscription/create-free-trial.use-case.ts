import { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { SubscriptionRepository } from "@api/lib/repositories"
import type { TransactionRepository } from "@api/lib/repositories"
import { IEventBus } from "@api/infrastructure/events/event-bus.interface"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { SubscriptionCreatedEvent } from "@api/domain/events/subscription-created.event"

interface ProductRepository {
  findFreeTrialProduct(): Promise<{
    product_id: number
    product_name: string
    price: number
    data: string | null
  } | null>
}

interface Dependencies {
  logger: ILogger
  subscriptionRepository: SubscriptionRepository
  transactionRepository: TransactionRepository
  productRepository: ProductRepository
  eventBus: IEventBus
}

interface Input {
  userId: number
  email: string
}

interface Output {
  subscriptionId: number
}

const ACTIVE_STATUSES = new Set(['active', 'suspended', 'trial'])

export class CreateFreeTrialUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: Input): Promise<UseCaseResult<Output>> {
    const { logger, subscriptionRepository, productRepository, eventBus } = this.deps

    try {
      // Check for existing subscriptions
      const existing = await subscriptionRepository.findByUserId(input.userId)
      const blocking = existing.filter((s) => ACTIVE_STATUSES.has(s.status ?? ''))
      if (blocking.length > 0) {
        return failure("User already has an active or trial subscription", "TRIAL_ALREADY_EXISTS")
      }

      // Get the free trial product
      const product = await productRepository.findFreeTrialProduct()
      if (!product) {
        return failure("Free trial product not found", "PRODUCT_NOT_FOUND")
      }

      const productData = product.data ? JSON.parse(product.data as string) : {}
      const durationDays = productData?.homeuptick?.free_trial?.duration_days ?? 90

      const now = new Date()
      const renewalDate = new Date(now)
      renewalDate.setDate(now.getDate() + durationDays)

      // Create the trial subscription
      const created = await subscriptionRepository.create({
        user_id: input.userId,
        product_id: product.product_id,
        subscription_name: product.product_name,
        amount: 0,
        status: 'trial',
        renewal_date: renewalDate,
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        data: JSON.stringify({ productData }),
        createdAt: now,
        updatedAt: now,
      } as any)

      const subscriptionId = (created as any)?.subscription_id ?? 0

      // Publish SubscriptionCreatedEvent
      await eventBus.publish(
        SubscriptionCreatedEvent.create(
          {
            subscriptionId,
            userId: input.userId,
            email: input.email,
            productId: product.product_id,
            productName: product.product_name,
            amount: 0,
            nextRenewalDate: renewalDate,
          },
          { productData }
        )
      )

      logger.info("Free trial created", { subscriptionId, userId: input.userId, renewalDate })

      return success({ subscriptionId })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Create free trial error", { error: errorMessage, userId: input.userId })
      return failure(errorMessage, "CREATE_TRIAL_ERROR")
    }
  }
}
