import { Selectable } from 'kysely'
import { IRepository } from './repository.interface'
import type { Subscriptions } from '@/lib/db'

/**
 * Subscription Repository Interface
 * Handles subscription records
 */
export interface ISubscriptionRepository extends IRepository<Subscriptions> {
  /**
   * Find all subscriptions for a user
   */
  findByUserId(userId: number): Promise<Selectable<Subscriptions>[]>

  /**
   * Find active subscriptions for a user
   */
  findActiveByUserId(userId: number): Promise<Selectable<Subscriptions>[]>

  /**
   * Find subscriptions due for renewal
   */
  findDueForRenewal(date: Date): Promise<Selectable<Subscriptions>[]>

  /**
   * Find subscriptions by product ID
   */
  findByProductId(productId: number): Promise<Selectable<Subscriptions>[]>

  /**
   * Update renewal date
   */
  updateRenewalDate(id: number, date: Date): Promise<Selectable<Subscriptions>>

  /**
   * Mark subscription for cancellation
   */
  markForCancellation(id: number): Promise<Selectable<Subscriptions>>

  /**
   * Mark subscription for downgrade
   */
  markForDowngrade(id: number, downgradeToProductId: number): Promise<Selectable<Subscriptions>>

  /**
   * Cancel subscription
   */
  cancel(id: number): Promise<Selectable<Subscriptions>>
}
