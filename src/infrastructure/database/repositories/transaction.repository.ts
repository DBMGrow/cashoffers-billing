import { Kysely, Selectable, Insertable, Updateable } from 'kysely'
import type { DB, Transactions } from '@/lib/db'
import { ITransactionRepository } from './transaction.repository.interface'

/**
 * Transaction Repository Implementation
 * Handles payment transaction records using Kysely
 */
export class TransactionRepository implements ITransactionRepository {
  constructor(private db: Kysely<DB>) {}

  async findById(id: number | bigint): Promise<Selectable<Transactions> | null> {
    const result = await this.db
      .selectFrom('Transactions')
      .where('transaction_id', '=', Number(id))
      .selectAll()
      .executeTakeFirst()

    return result || null
  }

  async findAll(criteria?: Partial<Selectable<Transactions>>): Promise<Selectable<Transactions>[]> {
    let query = this.db.selectFrom('Transactions').selectAll()

    if (criteria) {
      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.where(key as any, '=', value)
        }
      })
    }

    return await query.execute()
  }

  async findOne(criteria: Partial<Selectable<Transactions>>): Promise<Selectable<Transactions> | null> {
    let query = this.db.selectFrom('Transactions').selectAll()

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined) {
        query = query.where(key as any, '=', value)
      }
    })

    const result = await query.executeTakeFirst()
    return result || null
  }

  async create(data: Insertable<Transactions>): Promise<Selectable<Transactions>> {
    const result = await this.db
      .insertInto('Transactions')
      .values(data)
      .executeTakeFirstOrThrow()

    // Fetch the created record
    const created = await this.findById(Number(result.insertId))
    if (!created) {
      throw new Error('Failed to retrieve created transaction')
    }

    return created
  }

  async update(
    id: number | bigint,
    data: Updateable<Transactions>
  ): Promise<Selectable<Transactions>> {
    await this.db
      .updateTable('Transactions')
      .set(data)
      .where('transaction_id', '=', Number(id))
      .executeTakeFirstOrThrow()

    const updated = await this.findById(id)
    if (!updated) {
      throw new Error('Failed to retrieve updated transaction')
    }

    return updated
  }

  async delete(id: number | bigint): Promise<void> {
    await this.db
      .deleteFrom('Transactions')
      .where('transaction_id', '=', Number(id))
      .executeTakeFirstOrThrow()
  }

  // Custom methods specific to TransactionRepository

  async findBySquareTransactionId(
    squareTransactionId: string
  ): Promise<Selectable<Transactions> | null> {
    const result = await this.db
      .selectFrom('Transactions')
      .where('square_transaction_id', '=', squareTransactionId)
      .selectAll()
      .executeTakeFirst()

    return result || null
  }

  async findByUserId(userId: number): Promise<Selectable<Transactions>[]> {
    return await this.db
      .selectFrom('Transactions')
      .where('user_id', '=', userId)
      .selectAll()
      .orderBy('createdAt', 'desc')
      .execute()
  }

  async findBySubscriptionId(subscriptionId: number): Promise<Selectable<Transactions>[]> {
    // Note: subscription_id doesn't exist in Transactions table schema
    // This method may need to be removed or implement via join/data field
    return []
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Selectable<Transactions>[]> {
    return await this.db
      .selectFrom('Transactions')
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<=', endDate)
      .selectAll()
      .orderBy('createdAt', 'desc')
      .execute()
  }

  async getTotalAmountByUserId(userId: number): Promise<bigint> {
    const result = await this.db
      .selectFrom('Transactions')
      .where('user_id', '=', userId)
      .where('status', '=', 'completed')
      .select(({ fn }) => [fn.sum<string>('amount').as('total')])
      .executeTakeFirst()

    return result?.total ? BigInt(result.total) : BigInt(0)
  }
}

/**
 * Create a transaction repository
 */
export const createTransactionRepository = (db: Kysely<DB>): ITransactionRepository => {
  return new TransactionRepository(db)
}
