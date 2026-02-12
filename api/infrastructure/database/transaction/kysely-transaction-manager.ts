import { Kysely } from "kysely"
import { DB } from "@api/lib/db"
import { ITransactionManager } from "./transaction-manager.interface"
import { ILogger } from "@api/infrastructure/logging/logger.interface"

/**
 * Kysely Transaction Manager Implementation
 *
 * Wraps Kysely's transaction API to provide clean transaction boundaries.
 * Automatically handles commit/rollback based on callback success/failure.
 */
export class KyselyTransactionManager implements ITransactionManager {
  constructor(
    private readonly db: Kysely<DB>,
    private readonly logger: ILogger
  ) {}

  async runInTransaction<T>(
    callback: (trx: Kysely<DB>) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()

    try {
      this.logger.debug("Starting database transaction")

      const result = await this.db.transaction().execute(async (trx) => {
        return await callback(trx)
      })

      const duration = Date.now() - startTime
      this.logger.debug("Transaction committed successfully", { duration })

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : "Unknown error"

      this.logger.error("Transaction rolled back due to error", {
        error: errorMessage,
        duration,
      })

      throw error
    }
  }
}
