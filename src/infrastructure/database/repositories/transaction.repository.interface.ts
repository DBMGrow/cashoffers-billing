import { Selectable } from 'kysely'
import { IRepository } from './repository.interface'
import type { Transactions } from '@/lib/db'

/**
 * Transaction Repository Interface
 * Handles payment transaction records
 */
export interface ITransactionRepository extends IRepository<Transactions> {
  /**
   * Find transaction by Square transaction ID
   */
  findBySquareTransactionId(squareTransactionId: string): Promise<Selectable<Transactions> | null>

  /**
   * Find all transactions for a user
   */
  findByUserId(userId: number): Promise<Selectable<Transactions>[]>

  /**
   * Find all transactions for a subscription
   */
  findBySubscriptionId(subscriptionId: number): Promise<Selectable<Transactions>[]>

  /**
   * Find transactions by date range
   */
  findByDateRange(startDate: Date, endDate: Date): Promise<Selectable<Transactions>[]>

  /**
   * Get total transaction amount for a user
   */
  getTotalAmountByUserId(userId: number): Promise<bigint>
}
