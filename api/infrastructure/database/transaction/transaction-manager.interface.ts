import { Kysely } from "kysely"
import { DB } from "@/lib/db"

/**
 * Transaction Manager Interface
 *
 * Provides transaction boundaries for use cases.
 * Ensures atomic operations across multiple repository calls.
 */
export interface ITransactionManager {
  /**
   * Execute a function within a database transaction.
   * All database operations within the callback will be part of the same transaction.
   *
   * @param callback Function to execute within transaction context
   * @returns Promise resolving to the callback's return value
   * @throws Error if transaction fails or callback throws
   *
   * @example
   * ```typescript
   * await transactionManager.runInTransaction(async (trx) => {
   *   await subscriptionRepo.create(data, trx)
   *   await transactionRepo.create(logData, trx)
   *   return result
   * })
   * ```
   */
  runInTransaction<T>(
    callback: (trx: Kysely<DB>) => Promise<T>
  ): Promise<T>
}

/**
 * Type alias for transaction context
 * This is the same as Kysely<DB> but makes intent clearer
 */
export type TransactionContext = Kysely<DB>
