import { Kysely, Selectable, Insertable, Updateable } from 'kysely'
import type { DB, PurchaseRequests } from '@api/lib/db'
import { IPurchaseRequestRepository } from './purchase-request.repository.interface'
import { TransactionContext } from './repository.interface'
import { PurchaseRequestResults } from '@api/domain/entities/purchase-request'

/**
 * PurchaseRequest Repository Implementation
 * Handles purchase request records using Kysely
 *
 * Supports optional transaction context for all operations.
 * When a transaction context is provided, operations will be part of that transaction.
 */
export class PurchaseRequestRepository implements IPurchaseRequestRepository {
  constructor(private db: Kysely<DB>) {}

  async findById(id: number | bigint, trx?: TransactionContext): Promise<Selectable<PurchaseRequests> | null> {
    const db = trx ?? this.db

    const result = await db
      .selectFrom('PurchaseRequests')
      .where('request_id', '=', Number(id))
      .selectAll()
      .executeTakeFirst()

    return result || null
  }

  async findAll(criteria?: Partial<Selectable<PurchaseRequests>>, trx?: TransactionContext): Promise<Selectable<PurchaseRequests>[]> {
    const db = trx ?? this.db
    let query = db.selectFrom('PurchaseRequests').selectAll()

    if (criteria) {
      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.where(key as any, '=', value)
        }
      })
    }

    return await query.execute()
  }

  async findOne(criteria: Partial<Selectable<PurchaseRequests>>, trx?: TransactionContext): Promise<Selectable<PurchaseRequests> | null> {
    const db = trx ?? this.db
    let query = db.selectFrom('PurchaseRequests').selectAll()

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined) {
        query = query.where(key as any, '=', value)
      }
    })

    const result = await query.executeTakeFirst()
    return result || null
  }

  async create(data: Insertable<PurchaseRequests>, trx?: TransactionContext): Promise<Selectable<PurchaseRequests>> {
    const db = trx ?? this.db

    const result = await db
      .insertInto('PurchaseRequests')
      .values(data)
      .executeTakeFirstOrThrow()

    const created = await this.findById(Number(result.insertId), trx)
    if (!created) {
      throw new Error('Failed to retrieve created purchase request')
    }

    return created
  }

  async update(
    id: number | bigint,
    data: Updateable<PurchaseRequests>,
    trx?: TransactionContext
  ): Promise<Selectable<PurchaseRequests>> {
    const db = trx ?? this.db

    await db
      .updateTable('PurchaseRequests')
      .set(data)
      .where('request_id', '=', Number(id))
      .executeTakeFirstOrThrow()

    const updated = await this.findById(id, trx)
    if (!updated) {
      throw new Error('Failed to retrieve updated purchase request')
    }

    return updated
  }

  async delete(id: number | bigint, trx?: TransactionContext): Promise<void> {
    const db = trx ?? this.db

    await db
      .deleteFrom('PurchaseRequests')
      .where('request_id', '=', Number(id))
      .executeTakeFirstOrThrow()
  }

  // Custom methods specific to PurchaseRequestRepository

  async findByUuid(uuid: string, trx?: TransactionContext): Promise<Selectable<PurchaseRequests> | null> {
    const db = trx ?? this.db

    const result = await db
      .selectFrom('PurchaseRequests')
      .where('request_uuid', '=', uuid)
      .selectAll()
      .executeTakeFirst()

    return result || null
  }

  async findByStatus(status: string, trx?: TransactionContext): Promise<Selectable<PurchaseRequests>[]> {
    const db = trx ?? this.db

    return await db
      .selectFrom('PurchaseRequests')
      .where('status', '=', status as any)
      .selectAll()
      .orderBy('createdAt', 'desc')
      .execute()
  }

  async findDueForRetry(date: Date, trx?: TransactionContext): Promise<Selectable<PurchaseRequests>[]> {
    const db = trx ?? this.db

    return await db
      .selectFrom('PurchaseRequests')
      .where('status', '=', 'RETRY_SCHEDULED')
      .where('next_retry_at', '<=', date)
      .selectAll()
      .orderBy('next_retry_at', 'asc')
      .execute()
  }

  async findByEmail(email: string, trx?: TransactionContext): Promise<Selectable<PurchaseRequests>[]> {
    const db = trx ?? this.db

    return await db
      .selectFrom('PurchaseRequests')
      .where('email', '=', email)
      .selectAll()
      .orderBy('createdAt', 'desc')
      .execute()
  }

  async findBySubscriptionId(subscriptionId: number, trx?: TransactionContext): Promise<Selectable<PurchaseRequests>[]> {
    const db = trx ?? this.db

    return await db
      .selectFrom('PurchaseRequests')
      .where((eb) => eb.or([
        eb('subscription_id', '=', subscriptionId),
        eb('subscription_id_result', '=', subscriptionId)
      ]))
      .selectAll()
      .orderBy('createdAt', 'desc')
      .execute()
  }

  async markAsProcessing(id: number, trx?: TransactionContext): Promise<Selectable<PurchaseRequests>> {
    return await this.update(id, {
      status: 'VALIDATING',
      started_at: new Date(),
      updatedAt: new Date(),
    }, trx)
  }

  async markAsCompleted(
    id: number,
    results: PurchaseRequestResults,
    startedAt: Date,
    trx?: TransactionContext
  ): Promise<Selectable<PurchaseRequests>> {
    const completedAt = new Date()
    const duration = completedAt.getTime() - startedAt.getTime()

    return await this.update(id, {
      status: 'COMPLETED',
      subscription_id_result: results.subscriptionId,
      transaction_id_result: results.transactionId,
      amount_charged: results.amountCharged,
      card_id_result: results.cardId,
      completed_at: completedAt,
      processing_duration_ms: duration,
      updatedAt: new Date(),
    }, trx)
  }

  async markAsFailed(
    id: number,
    reason: string,
    errorCode?: string,
    trx?: TransactionContext
  ): Promise<Selectable<PurchaseRequests>> {
    return await this.update(id, {
      status: 'FAILED',
      failure_reason: reason,
      error_code: errorCode || null,
      completed_at: new Date(),
      updatedAt: new Date(),
    }, trx)
  }

  async scheduleRetry(
    id: number,
    nextRetryAt: Date,
    trx?: TransactionContext
  ): Promise<Selectable<PurchaseRequests>> {
    const current = await this.findById(id, trx)
    if (!current) {
      throw new Error(`Purchase request ${id} not found`)
    }

    return await this.update(id, {
      status: 'RETRY_SCHEDULED',
      retry_count: (current.retry_count ?? 0) + 1,
      next_retry_at: nextRetryAt,
      updatedAt: new Date(),
    }, trx)
  }

  async updateStatus(
    id: number,
    status: string,
    trx?: TransactionContext
  ): Promise<Selectable<PurchaseRequests>> {
    return await this.update(id, {
      status: status as any,
      updatedAt: new Date(),
    }, trx)
  }
}

/**
 * Create a purchase request repository
 */
export const createPurchaseRequestRepository = (db: Kysely<DB>): IPurchaseRequestRepository => {
  return new PurchaseRequestRepository(db)
}
