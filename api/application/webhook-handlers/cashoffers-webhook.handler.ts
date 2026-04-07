import type { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { IUserApiClient } from "@api/infrastructure/external-api/user-api.interface"
import type { SubscriptionRepository } from "@api/lib/repositories"
import type { ProductRepository } from "@api/lib/repositories"
import type { TransactionRepository } from "@api/lib/repositories"
import type { IEventBus } from "@api/infrastructure/events/event-bus.interface"
import { SubscriptionCreatedEvent } from "@api/domain/events/subscription-created.event"
import type { ProductData } from "@api/domain/types/product-data.types"

interface Dependencies {
  logger: ILogger
  userApiClient: IUserApiClient
  subscriptionRepository: SubscriptionRepository
  productRepository?: ProductRepository
  transactionRepository?: TransactionRepository
  eventBus: IEventBus
}

type WebhookEvent =
  | { type: 'user.deactivated'; userId: number }
  | { type: 'user.activated'; userId: number }
  | { type: 'user.created'; userId: number }

/**
 * CashOffersWebhookHandler
 *
 * Processes incoming webhook events from the CashOffers main API:
 * - user.deactivated → pause user's active subscription
 * - user.activated → resume user's suspended subscription (with renewal date adjustment)
 * - user.created (free user) → create free trial subscription
 */
export class CashOffersWebhookHandler {
  constructor(private readonly deps: Dependencies) {}

  async handle(event: WebhookEvent): Promise<void> {
    const { logger } = this.deps
    logger.info("Processing CashOffers webhook", { type: event.type, userId: event.userId })

    switch (event.type) {
      case 'user.deactivated':
        await this.handleUserDeactivated(event.userId)
        break
      case 'user.activated':
        await this.handleUserActivated(event.userId)
        break
      case 'user.created':
        await this.handleUserCreated(event.userId)
        break
    }
  }

  private async handleUserDeactivated(userId: number): Promise<void> {
    const { subscriptionRepository } = this.deps
    const subscriptions = await subscriptionRepository.findActiveByUserId(userId)

    const active = subscriptions.filter((s) => s.status === 'active')
    for (const sub of active) {
      const now = new Date()
      await subscriptionRepository.update(sub.subscription_id, {
        status: 'suspended',
        suspension_date: now,
        updatedAt: now,
      } as any)
    }
  }

  private async handleUserActivated(userId: number): Promise<void> {
    const { subscriptionRepository } = this.deps
    const subscriptions = await subscriptionRepository.findByUserId(userId)

    const suspended = subscriptions.filter((s) => s.status === 'suspended')
    for (const sub of suspended) {
      const now = new Date()
      let newRenewalDate = sub.renewal_date ? new Date(sub.renewal_date) : now

      if (sub.suspension_date && sub.renewal_date) {
        const suspensionDate = new Date(sub.suspension_date)
        const originalRenewalDate = new Date(sub.renewal_date)
        const daysRemaining = Math.round(
          (originalRenewalDate.getTime() - suspensionDate.getTime()) / (1000 * 60 * 60 * 24)
        )
        newRenewalDate = new Date(now)
        newRenewalDate.setDate(now.getDate() + daysRemaining)
      }

      await subscriptionRepository.update(sub.subscription_id, {
        status: 'active',
        suspension_date: null,
        renewal_date: newRenewalDate,
        updatedAt: now,
      } as any)
    }
  }

  private async handleUserCreated(userId: number): Promise<void> {
    const { subscriptionRepository, userApiClient, eventBus, logger, productRepository } = this.deps

    const existing = await subscriptionRepository.findByUserId(userId)
    const hasActiveSub = existing.some((s) =>
      ['active', 'trial', 'suspended'].includes(s.status ?? '')
    )
    if (hasActiveSub) return

    try {
      const user = await userApiClient.getUser(userId)
      if (!user) return

      // Look up free trial product for productData metadata
      let productData: ProductData | undefined
      let productId = 0
      if (productRepository && 'findFreeTrialProduct' in productRepository) {
        try {
          const freeTrialProduct = await (productRepository as any).findFreeTrialProduct()
          if (freeTrialProduct) {
            productId = freeTrialProduct.product_id
            productData = typeof freeTrialProduct.data === 'string'
              ? JSON.parse(freeTrialProduct.data)
              : freeTrialProduct.data
          }
        } catch {
          logger.warn('Could not find free trial product, using defaults')
        }
      }

      // Default productData for free trial if no product found
      if (!productData) {
        productData = {
          cashoffers: { managed: true, user_config: { role: 'SHELL', is_premium: 0 } },
          homeuptick: { enabled: true, free_trial: { enabled: true, contacts: 100, duration_days: 90 } },
        }
      }

      const now = new Date()
      const durationDays = productData.homeuptick?.free_trial?.duration_days ?? 90
      const renewalDate = new Date(now)
      renewalDate.setDate(now.getDate() + durationDays)

      const created = await subscriptionRepository.create({
        user_id: userId,
        product_id: productId || undefined,
        subscription_name: 'Free Trial',
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

      // Attach productData in metadata so CO/HU handlers can provision correctly
      await eventBus.publish(
        SubscriptionCreatedEvent.create({
          subscriptionId,
          userId,
          email: (user as any).email ?? '',
          productId,
          productName: 'Free Trial',
          amount: 0,
          nextRenewalDate: renewalDate,
        }, { productData })
      )
    } catch (error) {
      logger.error("Failed to create free trial via webhook", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
