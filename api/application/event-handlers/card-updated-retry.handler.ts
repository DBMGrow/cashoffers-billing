import type { IDomainEvent, IEventHandler } from "@api/infrastructure/events/event-bus.interface"
import type { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { SubscriptionRepository } from "@api/lib/repositories"

interface RenewSubscriptionUseCase {
  execute(input: { subscriptionId: number; email: string }): Promise<{ success: boolean; error?: string }>
}

interface Dependencies {
  logger: ILogger
  subscriptionRepository: SubscriptionRepository
  renewSubscriptionUseCase: RenewSubscriptionUseCase
}

/**
 * CardUpdatedRetryHandler
 *
 * When a card is updated, immediately retry renewal for any subscriptions
 * that have a pending retry (next_renewal_attempt set) or are suspended
 * due to payment failures.
 */
export class CardUpdatedRetryHandler implements IEventHandler {
  constructor(private readonly deps: Dependencies) {}

  async handle(event: IDomainEvent): Promise<void> {
    if (event.eventType !== 'CardUpdated') return

    const { logger, subscriptionRepository, renewSubscriptionUseCase } = this.deps
    const payload = event.payload as any
    const userId = payload.userId
    const email = payload.email

    const subscriptions = await subscriptionRepository.findByUserId(userId)

    const needsRetry = subscriptions.filter(
      (s) => s.next_renewal_attempt !== null || s.status === 'suspended'
    )

    for (const sub of needsRetry) {
      try {
        await renewSubscriptionUseCase.execute({
          subscriptionId: sub.subscription_id,
          email,
        })
      } catch (error) {
        logger.error("Card-update renewal retry failed", {
          subscriptionId: sub.subscription_id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }
}
