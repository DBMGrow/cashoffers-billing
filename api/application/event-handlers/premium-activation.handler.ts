import { BaseEventHandler } from '@/infrastructure/events/base-event-handler'
import type { IDomainEvent } from '@/infrastructure/events/event-bus.interface'
import type { IUserApiClient } from '@/infrastructure/external-api/user-api.interface'
import type { ILogger } from '@/infrastructure/logging/logger.interface'
import type { SubscriptionCreatedEvent } from '@/domain/events/subscription-created.event'
import type { SubscriptionRenewedEvent } from '@/domain/events/subscription-renewed.event'

/**
 * Handles activating user premium status when subscriptions are created or renewed.
 * This is a critical handler - premium status must be activated for subscriptions to work correctly.
 */
export class PremiumActivationHandler extends BaseEventHandler {
  constructor(
    private userApiClient: IUserApiClient,
    logger: ILogger
  ) {
    super(logger)
  }

  getEventTypes(): string[] {
    return ['SubscriptionCreated', 'SubscriptionRenewed']
  }

  async handle(event: IDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'SubscriptionCreated':
        await this.handleSubscriptionCreated(event as SubscriptionCreatedEvent)
        break
      case 'SubscriptionRenewed':
        await this.handleSubscriptionRenewed(event as SubscriptionRenewedEvent)
        break
      default:
        this.logger.warn('Unhandled event type in PremiumActivationHandler', {
          eventType: event.eventType,
        })
    }
  }

  /**
   * Activate premium status when a new subscription is created.
   */
  private async handleSubscriptionCreated(
    event: SubscriptionCreatedEvent
  ): Promise<void> {
    await this.criticalExecute(
      async () => {
        const { userId, email } = event.payload

        this.logger.info('Activating premium status for new subscription', {
          userId,
          email,
          subscriptionId: event.payload.subscriptionId,
        })

        await this.userApiClient.activateUserPremium(userId)

        this.logger.info('Premium status activated successfully', {
          userId,
          subscriptionId: event.payload.subscriptionId,
        })
      },
      event,
      'Failed to activate premium status for new subscription'
    )
  }

  /**
   * Ensure premium status is active when a subscription is renewed.
   * In most cases, the user should already have premium status, but this ensures consistency.
   */
  private async handleSubscriptionRenewed(
    event: SubscriptionRenewedEvent
  ): Promise<void> {
    await this.criticalExecute(
      async () => {
        const { userId, email } = event.payload

        this.logger.info('Ensuring premium status for renewed subscription', {
          userId,
          email,
          subscriptionId: event.payload.subscriptionId,
        })

        await this.userApiClient.activateUserPremium(userId)

        this.logger.info('Premium status confirmed for renewed subscription', {
          userId,
          subscriptionId: event.payload.subscriptionId,
        })
      },
      event,
      'Failed to ensure premium status for renewed subscription'
    )
  }
}
