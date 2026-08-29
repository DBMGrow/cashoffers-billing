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
 * One calendar month after `from`, clamped to the end of the target month.
 *
 * Plain `setMonth(getMonth() + 1)` overflows — 31 Jan becomes 3 Mar, not 28 Feb — which would
 * silently hand the customer two or three extra days on every month-end reactivation.
 */
export function addOneMonth(from: Date): Date {
  const result = new Date(from)
  const dayOfMonth = result.getDate()

  result.setMonth(result.getMonth() + 1)

  // If the day changed, the target month was shorter and JS rolled us into the next one.
  // setDate(0) steps back to the last day of the intended month.
  if (result.getDate() !== dayOfMonth) result.setDate(0)

  return result
}

/**
 * CashOffersWebhookHandler
 *
 * Processes incoming webhook events from the CashOffers main API:
 * - user.deactivated → pause user's active subscription
 * - user.activated → resume user's most recent paused/suspended/cancelled subscription, renewing one calendar month from the reactivation date (Desk #1644)
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
        status: 'paused',
        suspension_date: now,
        updatedAt: now,
      } as any)
    }
  }

  // Statuses a reactivation is allowed to resume. We resume not just 'paused'
  // (set by handleUserDeactivated) but also 'suspended' (terminal dunning) and
  // 'cancelled' (e.g. trial expiry — see subscriptionsCron). Previously only
  // 'paused' was handled, so a user who signed back up with a cancelled/suspended
  // subscription was left premium-in-UI but with no active sub, and the renewal
  // cron (active-only) never charged them again — ticket #1475.
  private static readonly RESUMABLE_STATUSES = new Set(['paused', 'suspended', 'cancelled'])

  private async handleUserActivated(userId: number): Promise<void> {
    const { subscriptionRepository, logger } = this.deps
    const subscriptions = await subscriptionRepository.findByUserId(userId)

    // Idempotency / safety: if the user already has a live subscription, there is
    // nothing to resume — and resuming another row on top would double-bill.
    if (subscriptions.some((s) => s.status === 'active' || s.status === 'trial')) return

    // Resume only the most recent resumable subscription (highest subscription_id).
    // A user may carry old cancelled rows from prior plans; reviving all of them
    // would create duplicate active subscriptions and duplicate charges.
    const sub = subscriptions
      .filter((s) => CashOffersWebhookHandler.RESUMABLE_STATUSES.has(s.status ?? ''))
      .sort((a, b) => (b.subscription_id ?? 0) - (a.subscription_id ?? 0))[0]
    if (!sub) return

    const now = new Date()

    // Desk #1644: a reactivated account starts a fresh cycle from the day it comes back —
    // "the renewal date [is] the date their account is reactivated +1 month".
    //
    // This replaces the previous rule, which carried over the days remaining at suspension
    // and then clamped a past date to now. That rule produced two bad outcomes: a
    // long-suspended subscription resumed with renewal = today and was charged immediately
    // (staging subscription 83, 151 days overdue, resumed with renewal = the same day), and a
    // briefly-suspended one resumed with only its leftover days. Always billing one month
    // forward is what the account holder is told they are buying, and it keeps the renewal
    // date in the future, so the "charged repeatedly to catch up" failure the old clamp
    // guarded against cannot occur.
    const newRenewalDate = addOneMonth(now)

    await subscriptionRepository.update(sub.subscription_id, {
      status: 'active',
      suspension_date: null,
      renewal_date: newRenewalDate,
      updatedAt: now,
    } as any)

    logger.info('Resumed subscription on user.activated', {
      userId,
      subscriptionId: sub.subscription_id,
      previousStatus: sub.status,
      renewalDate: newRenewalDate,
    })
  }

  private async handleUserCreated(userId: number): Promise<void> {
    const { subscriptionRepository, userApiClient, eventBus, logger, productRepository } = this.deps

    const existing = await subscriptionRepository.findByUserId(userId)
    const hasActiveSub = existing.some((s) =>
      ['active', 'trial', 'paused', 'suspended'].includes(s.status ?? '')
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
          cashoffers: { managed: true, user_config: { role: 'HOMEUPTICK', is_premium: 0 } },
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
