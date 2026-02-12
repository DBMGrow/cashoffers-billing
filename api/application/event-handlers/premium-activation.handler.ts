import { BaseEventHandler } from '@api/infrastructure/events/base-event-handler'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'
import type { IUserApiClient } from '@api/infrastructure/external-api/user-api.interface'
import type { ILogger } from '@api/infrastructure/logging/logger.interface'
import type { SubscriptionCreatedEvent } from '@api/domain/events/subscription-created.event'
import type { SubscriptionRenewedEvent } from '@api/domain/events/subscription-renewed.event'

/**
 * Handles activating user premium status when subscriptions are created or renewed.
 * This is a critical handler - premium status must be activated for subscriptions to work correctly.
 *
 * Uses activateUser() which sets BOTH active = true AND is_premium = true.
 * This ensures that users who were fully deactivated (active = 0) are reactivated on renewal.
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
   * Uses activateUser() to ensure both active and is_premium are set to true.
   */
  private async handleSubscriptionCreated(
    event: SubscriptionCreatedEvent
  ): Promise<void> {
    await this.criticalExecute(
      async () => {
        const { userId, email } = event.payload

        this.logger.info('Fully activating user for new subscription', {
          userId,
          email,
          subscriptionId: event.payload.subscriptionId,
        })

        await this.userApiClient.activateUser(userId)

        this.logger.info('User fully activated (active = 1, is_premium = 1)', {
          userId,
          subscriptionId: event.payload.subscriptionId,
        })
      },
      event,
      'Failed to activate user for new subscription'
    )
  }

  /**
   * Ensure user is fully active when a subscription is renewed.
   * This is critical: if user was deactivated (active = 0) during suspension,
   * this will reactivate them. Also ensures is_premium = 1.
   */
  private async handleSubscriptionRenewed(
    event: SubscriptionRenewedEvent
  ): Promise<void> {
    await this.criticalExecute(
      async () => {
        const { userId, email } = event.payload

        this.logger.info('Fully activating user for renewed subscription', {
          userId,
          email,
          subscriptionId: event.payload.subscriptionId,
        })

        await this.userApiClient.activateUser(userId)

        this.logger.info('User fully activated on renewal (active = 1, is_premium = 1)', {
          userId,
          subscriptionId: event.payload.subscriptionId,
        })
      },
      event,
      'Failed to activate user for renewed subscription'
    )
  }
}
