import { Selectable } from 'kysely'
import { IRepository, TransactionContext } from './repository.interface'
import type { Subscriptions } from '@/lib/db'

/**
 * Subscription Repository Interface
 * Handles subscription records
 * All methods support optional transaction context for atomic operations
 */
export interface ISubscriptionRepository extends IRepository<Subscriptions> {
  /**
   * Find all subscriptions for a user
   */
  findByUserId(userId: number, trx?: TransactionContext): Promise<Selectable<Subscriptions>[]>

  /**
   * Find active subscriptions for a user
   */
  findActiveByUserId(userId: number, trx?: TransactionContext): Promise<Selectable<Subscriptions>[]>

  /**
   * Find subscriptions due for renewal
   */
  findDueForRenewal(date: Date, trx?: TransactionContext): Promise<Selectable<Subscriptions>[]>

  /**
   * Find subscriptions by product ID
   */
  findByProductId(productId: number, trx?: TransactionContext): Promise<Selectable<Subscriptions>[]>

  /**
   * Update renewal date
   */
  updateRenewalDate(id: number, date: Date, trx?: TransactionContext): Promise<Selectable<Subscriptions>>

  /**
   * Mark subscription for cancellation
   */
  markForCancellation(id: number, trx?: TransactionContext): Promise<Selectable<Subscriptions>>

  /**
   * Mark subscription for downgrade
   */
  markForDowngrade(id: number, downgradeToProductId: number, trx?: TransactionContext): Promise<Selectable<Subscriptions>>

  /**
   * Cancel subscription
   */
  cancel(id: number, trx?: TransactionContext): Promise<Selectable<Subscriptions>>
}
