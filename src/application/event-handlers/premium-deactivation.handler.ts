import { BaseEventHandler } from '@/infrastructure/events/base-event-handler'
import type { IDomainEvent } from '@/infrastructure/events/event-bus.interface'
import type { IUserApiClient } from '@/infrastructure/external-api/user-api.interface'
import type { ILogger } from '@/infrastructure/logging/logger.interface'
import type { SubscriptionDeactivatedEvent } from '@/domain/events/subscription-deactivated.event'
import type { SubscriptionPausedEvent } from '@/domain/events/subscription-paused.event'

/**
 * Handles deactivating user premium status when subscriptions end or are paused.
 * This is a critical handler - premium status must be deactivated when subscription ends.
 */
export class PremiumDeactivationHandler extends BaseEventHandler {
  constructor(
    private userApiClient: IUserApiClient,
    logger: ILogger
  ) {
    super(logger)
  }

  getEventTypes(): string[] {
    return ['SubscriptionDeactivated', 'SubscriptionPaused']
  }

  async handle(event: IDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'SubscriptionDeactivated':
        await this.handleSubscriptionDeactivated(event as SubscriptionDeactivatedEvent)
        break
      case 'SubscriptionPaused':
        await this.handleSubscriptionPaused(event as SubscriptionPausedEvent)
        break
      default:
        this.logger.warn('Unhandled event type in PremiumDeactivationHandler', {
          eventType: event.eventType,
        })
    }
  }

  /**
   * Deactivate premium status when subscription is deactivated.
   */
  private async handleSubscriptionDeactivated(
    event: SubscriptionDeactivatedEvent
  ): Promise<void> {
    await this.criticalExecute(
      async () => {
        const { userId, subscriptionId, reason } = event.payload

        this.logger.info('Deactivating premium status for deactivated subscription', {
          userId,
          subscriptionId,
          reason,
        })

        await this.userApiClient.deactivateUserPremium(userId)

        this.logger.info('Premium status deactivated successfully', {
          userId,
          subscriptionId,
        })
      },
      event,
      'Failed to deactivate premium status'
    )
  }

  /**
   * Deactivate premium status when subscription is paused.
   */
  private async handleSubscriptionPaused(
    event: SubscriptionPausedEvent
  ): Promise<void> {
    await this.criticalExecute(
      async () => {
        const { userId, subscriptionId, reason } = event.payload

        this.logger.info('Deactivating premium status for paused subscription', {
          userId,
          subscriptionId,
          reason,
        })

        await this.userApiClient.deactivateUserPremium(userId)

        this.logger.info('Premium status deactivated for paused subscription', {
          userId,
          subscriptionId,
        })
      },
      event,
      'Failed to deactivate premium status for paused subscription'
    )
  }
}
