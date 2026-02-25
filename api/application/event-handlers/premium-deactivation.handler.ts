import { BaseEventHandler } from '@api/infrastructure/events/base-event-handler'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'
import type { IUserApiClient } from '@api/infrastructure/external-api/user-api.interface'
import type { ILogger } from '@api/infrastructure/logging/logger.interface'
import type { SubscriptionDeactivatedEvent } from '@api/domain/events/subscription-deactivated.event'
import type { SubscriptionPausedEvent } from '@api/domain/events/subscription-paused.event'
import type { WhitelabelRepository } from '@api/lib/repositories'
import type { SubscriptionRepository } from '@api/lib/repositories'
import type { SubscriptionData } from '@api/domain/types/product-data.types'

/**
 * Handles deactivating user premium status when subscriptions end or are paused.
 * This is a critical handler - premium status must be deactivated when subscription ends.
 *
 * Behavior depends on whitelabel configuration:
 * - DOWNGRADE_TO_FREE: Sets is_premium = 0, user remains active (default)
 * - DEACTIVATE_USER: Sets active = 0, full account deactivation
 */
export class PremiumDeactivationHandler extends BaseEventHandler {
  constructor(
    private userApiClient: IUserApiClient,
    private whitelabelRepository: WhitelabelRepository,
    private subscriptionRepository: SubscriptionRepository,
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

        this.logger.info('Processing subscription deactivation', {
          userId,
          subscriptionId,
          reason,
        })

        await this.deactivateUserByWhitelabelConfig(userId, subscriptionId)

        this.logger.info('User deactivation completed successfully', {
          userId,
          subscriptionId,
        })
      },
      event,
      'Failed to deactivate user for deactivated subscription'
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

        this.logger.info('Processing subscription pause', {
          userId,
          subscriptionId,
          reason,
        })

        await this.deactivateUserByWhitelabelConfig(userId, subscriptionId)

        this.logger.info('User deactivation for pause completed successfully', {
          userId,
          subscriptionId,
        })
      },
      event,
      'Failed to deactivate user for paused subscription'
    )
  }

  /**
   * Deactivate user based on whitelabel-specific suspension behavior.
   *
   * Logic:
   * 1. Fetch subscription to get user_config.whitelabel_id from data field
   * 2. If whitelabel_id exists, fetch suspension_behavior from Whitelabels table
   * 3. Apply behavior:
   *    - DEACTIVATE_USER: Call deactivateUser (sets active = 0)
   *    - DOWNGRADE_TO_FREE or null: Call deactivateUserPremium (sets is_premium = 0)
   * 4. Fallback: If any lookup fails, default to DOWNGRADE_TO_FREE
   */
  private async deactivateUserByWhitelabelConfig(
    userId: number,
    subscriptionId: number
  ): Promise<void> {
    try {
      // Fetch subscription to extract whitelabel_id from data field
      const subscription = await this.subscriptionRepository.findById(subscriptionId)

      if (!subscription) {
        this.logger.warn('Subscription not found, defaulting to downgrade to free', {
          userId,
          subscriptionId,
        })
        await this.userApiClient.deactivateUserPremium(userId)
        return
      }

      // Parse subscription data to extract whitelabel_id
      let whitelabelId: number | null = null
      if (subscription.data) {
        try {
          const subscriptionData = typeof subscription.data === 'string'
            ? JSON.parse(subscription.data) as SubscriptionData
            : subscription.data as SubscriptionData

          whitelabelId = subscriptionData.user_config?.whitelabel_id ?? null
        } catch (parseError) {
          this.logger.warn('Failed to parse subscription data, defaulting to downgrade to free', {
            userId,
            subscriptionId,
            error: parseError,
          })
        }
      }

      // If no whitelabel_id, default to DOWNGRADE_TO_FREE
      if (!whitelabelId) {
        this.logger.info('No whitelabel_id found, applying default behavior: DOWNGRADE_TO_FREE', {
          userId,
          subscriptionId,
        })
        await this.userApiClient.deactivateUserPremium(userId)
        return
      }

      // Fetch suspension behavior from whitelabel
      const suspensionBehavior = await this.whitelabelRepository.getSuspensionBehavior(whitelabelId)

      if (!suspensionBehavior) {
        this.logger.warn('Whitelabel not found or no suspension behavior configured, defaulting to DOWNGRADE_TO_FREE', {
          userId,
          subscriptionId,
          whitelabelId,
        })
        await this.userApiClient.deactivateUserPremium(userId)
        return
      }

      // Apply whitelabel-specific suspension behavior
      this.logger.info('Applying whitelabel-specific suspension behavior', {
        userId,
        subscriptionId,
        whitelabelId,
        suspensionBehavior,
      })

      if (suspensionBehavior === 'DEACTIVATE_USER') {
        this.logger.info('Deactivating user (setting active = 0)', { userId, whitelabelId })
        await this.userApiClient.deactivateUser(userId)
      } else {
        // DOWNGRADE_TO_FREE
        this.logger.info('Downgrading user to free (setting is_premium = 0)', { userId, whitelabelId })
        await this.userApiClient.deactivateUserPremium(userId)
      }

    } catch (error) {
      // Fallback to safe default on any error
      this.logger.error('Error determining suspension behavior, falling back to DOWNGRADE_TO_FREE', error, {
        userId,
        subscriptionId,
      })
      await this.userApiClient.deactivateUserPremium(userId)
    }
  }
}
