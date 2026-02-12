import { Kysely, Selectable, Insertable, Updateable } from 'kysely'
import type { DB, Subscriptions } from '@api/lib/db'
import { ISubscriptionRepository } from './subscription.repository.interface'
import { TransactionContext } from './repository.interface'

/**
 * Subscription Repository Implementation
 * Handles subscription records using Kysely
 *
 * Supports optional transaction context for all operations.
 * When a transaction context is provided, operations will be part of that transaction.
 */
export class SubscriptionRepository implements ISubscriptionRepository {
  constructor(private db: Kysely<DB>) {}

  async findById(id: number | bigint, trx?: TransactionContext): Promise<Selectable<Subscriptions> | null> {
    const db = trx ?? this.db

    const result = await db
      .selectFrom('Subscriptions')
      .where('subscription_id', '=', Number(id))
      .selectAll()
      .executeTakeFirst()

    return result || null
  }

  async findAll(criteria?: Partial<Selectable<Subscriptions>>, trx?: TransactionContext): Promise<Selectable<Subscriptions>[]> {
    const db = trx ?? this.db
    let query = db.selectFrom('Subscriptions').selectAll()

    if (criteria) {
      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.where(key as any, '=', value)
        }
      })
    }

    return await query.execute()
  }

  async findOne(criteria: Partial<Selectable<Subscriptions>>, trx?: TransactionContext): Promise<Selectable<Subscriptions> | null> {
    const db = trx ?? this.db
    let query = db.selectFrom('Subscriptions').selectAll()

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined) {
        query = query.where(key as any, '=', value)
      }
    })

    const result = await query.executeTakeFirst()
    return result || null
  }

  async create(data: Insertable<Subscriptions>, trx?: TransactionContext): Promise<Selectable<Subscriptions>> {
    const db = trx ?? this.db

    const result = await db
      .insertInto('Subscriptions')
      .values(data)
      .executeTakeFirstOrThrow()

    const created = await this.findById(Number(result.insertId), trx)
    if (!created) {
      throw new Error('Failed to retrieve created subscription')
    }

    return created
  }

  async update(
    id: number | bigint,
    data: Updateable<Subscriptions>,
    trx?: TransactionContext
  ): Promise<Selectable<Subscriptions>> {
    const db = trx ?? this.db

    await db
      .updateTable('Subscriptions')
      .set(data)
      .where('subscription_id', '=', Number(id))
      .executeTakeFirstOrThrow()

    const updated = await this.findById(id, trx)
    if (!updated) {
      throw new Error('Failed to retrieve updated subscription')
    }

    return updated
  }

  async delete(id: number | bigint, trx?: TransactionContext): Promise<void> {
    const db = trx ?? this.db

    await db
      .deleteFrom('Subscriptions')
      .where('subscription_id', '=', Number(id))
      .executeTakeFirstOrThrow()
  }

  // Custom methods specific to SubscriptionRepository

  async findByUserId(userId: number, trx?: TransactionContext): Promise<Selectable<Subscriptions>[]> {
    const db = trx ?? this.db

    return await db
      .selectFrom('Subscriptions')
      .where('user_id', '=', userId)
      .selectAll()
      .orderBy('createdAt', 'desc')
      .execute()
  }

  async findActiveByUserId(userId: number, trx?: TransactionContext): Promise<Selectable<Subscriptions>[]> {
    const db = trx ?? this.db

    return await db
      .selectFrom('Subscriptions')
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .selectAll()
      .orderBy('createdAt', 'desc')
      .execute()
  }

  async findDueForRenewal(date: Date, trx?: TransactionContext): Promise<Selectable<Subscriptions>[]> {
    const db = trx ?? this.db

    return await db
      .selectFrom('Subscriptions')
      .where('status', '=', 'active')
      .where('renewal_date', '<=', date)
      .where('cancel_on_renewal', '=', 0)
      .selectAll()
      .orderBy('renewal_date', 'asc')
      .execute()
  }

  async findByProductId(productId: number, trx?: TransactionContext): Promise<Selectable<Subscriptions>[]> {
    const db = trx ?? this.db

    return await db
      .selectFrom('Subscriptions')
      .where('product_id', '=', productId)
      .selectAll()
      .orderBy('createdAt', 'desc')
      .execute()
  }

  async updateRenewalDate(id: number, date: Date, trx?: TransactionContext): Promise<Selectable<Subscriptions>> {
    return await this.update(id, {
      renewal_date: date,
      updatedAt: new Date(),
    }, trx)
  }

  async markForCancellation(id: number, trx?: TransactionContext): Promise<Selectable<Subscriptions>> {
    return await this.update(id, {
      cancel_on_renewal: 1,
      updatedAt: new Date(),
    }, trx)
  }

  async markForDowngrade(id: number, downgradeToProductId: number, trx?: TransactionContext): Promise<Selectable<Subscriptions>> {
    return await this.update(id, {
      downgrade_on_renewal: 1,
      // Note: downgrade_to_product_id doesn't exist in schema, storing in meta or data
      updatedAt: new Date(),
    }, trx)
  }

  async cancel(id: number, trx?: TransactionContext): Promise<Selectable<Subscriptions>> {
    return await this.update(id, {
      status: 'cancelled',
      updatedAt: new Date(),
    }, trx)
  }

  async findSubscriptionsForCronProcessing(date: Date, trx?: TransactionContext): Promise<Selectable<Subscriptions>[]> {
    const db = trx ?? this.db

    return await db
      .selectFrom('Subscriptions')
      .where('status', '=', 'active')
      .where((eb) =>
        eb.or([
          eb('next_renewal_attempt', 'is', null),
          eb('next_renewal_attempt', '<=', date)
        ])
      )
      .where((eb) =>
        eb.or([
          eb('renewal_date', 'is', null),
          eb('renewal_date', '<=', date)
        ])
      )
      .selectAll()
      .execute()
  }

  async findByEnvironment(
    environment: 'production' | 'sandbox',
    trx?: TransactionContext
  ): Promise<Selectable<Subscriptions>[]> {
    const db = trx ?? this.db
    return await db
      .selectFrom('Subscriptions')
      .where('square_environment', '=', environment)
      .selectAll()
      .orderBy('createdAt', 'desc')
      .execute()
  }
}

/**
 * Create a subscription repository
 */
export const createSubscriptionRepository = (db: Kysely<DB>): ISubscriptionRepository => {
  return new SubscriptionRepository(db)
}
