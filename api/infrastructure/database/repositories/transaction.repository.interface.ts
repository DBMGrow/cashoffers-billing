import { Selectable } from 'kysely'
import { IRepository } from './repository.interface'
import type { Transactions } from '@/lib/db'

/**
 * Transaction Repository Interface
 * Handles payment transaction records
 */
export interface ITransactionRepository extends IRepository<Transactions> {
  /**
   * Find transactions by Square transaction ID (returns array for consistency)
   */
  findBySquareTransactionId(squareTransactionId: string): Promise<Selectable<Transactions>[]>

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

  /**
   * Find transactions by type with pagination
   */
  findByType(
    types: string[],
    options?: {
      userId?: number
      limit?: number
      offset?: number
    }
  ): Promise<Selectable<Transactions>[]>

  /**
   * Count transactions by type
   */
  countByType(
    types: string[],
    options?: {
      userId?: number
    }
  ): Promise<number>

  /**
   * Find transactions by environment
   */
  findByEnvironment(
    environment: 'production' | 'sandbox'
  ): Promise<Selectable<Transactions>[]>
}
