import { Kysely, Selectable, Insertable, Updateable, sql } from 'kysely'
import type { DB, Subscriptions } from '@api/lib/db'
import { TransactionContext } from '../transaction/transaction-manager.interface'

/**
 * Subscription Repository Implementation
 * Handles subscription records using Kysely
 *
 * Supports optional transaction context for all operations.
 * When a transaction context is provided, operations will be part of that transaction.
 */
export class SubscriptionRepository {
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
      // Exclude subscriptions without a bound user — pending_provisioning subscriptions
      // have no user account yet and cannot be renewed until manually resolved.
      .where('user_id', 'is not', null)
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

  async markForDowngrade(id: number, _downgradeToProductId: number, trx?: TransactionContext): Promise<Selectable<Subscriptions>> {
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
      // Exclude subscriptions without a bound user — pending_provisioning subscriptions
      // have no user account yet and cannot be renewed until manually resolved.
      .where('user_id', 'is not', null)
      .selectAll()
      .execute()
  }

  /**
   * Find subscriptions where user provisioning failed after payment.
   * These require manual intervention to create the user account and bind it.
   */
  async findPendingProvisioning(trx?: TransactionContext): Promise<Selectable<Subscriptions>[]> {
    const db = trx ?? this.db

    return await db
      .selectFrom('Subscriptions')
      .where('provisioning_status', '=', 'pending_provisioning')
      .selectAll()
      .orderBy('createdAt', 'asc')
      .execute()
  }

  async findExpiredTrials(date: Date, trx?: TransactionContext): Promise<Selectable<Subscriptions>[]> {
    const db = trx ?? this.db
    return await db
      .selectFrom('Subscriptions')
      .where('status', '=', 'trial')
      .where('renewal_date', '<=', date)
      .selectAll()
      .execute()
  }

  /**
   * Find trial subscriptions expiring within a given number of days from now.
   * Used for sending trial expiration warning emails (e.g., 10 days before expiry).
   */
  async findTrialsExpiringSoon(withinDays: number, trx?: TransactionContext): Promise<Selectable<Subscriptions>[]> {
    const db = trx ?? this.db
    const now = new Date()
    const futureDate = new Date(now)
    futureDate.setDate(now.getDate() + withinDays)

    return await db
      .selectFrom('Subscriptions')
      .where('status', '=', 'trial')
      .where('renewal_date', '>', now)
      .where('renewal_date', '<=', futureDate)
      .selectAll()
      .execute()
  }

  /**
   * Card-on-file free trials (Desk #1350, `data.trial`) whose first charge lands within `days` of
   * `now` and whose trial-ending reminder has not gone out. A cancelled or cancel-on-renewal trial
   * gets no reminder: it will not be charged. `ends_at` is always written by `toISOString()`, so the
   * string comparison is a time comparison.
   */
  async findTrialsEndingWithin(days: number, now: Date = new Date(), trx?: TransactionContext): Promise<Selectable<Subscriptions>[]> {
    const db = trx ?? this.db
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    const endsAt = sql<string>`JSON_UNQUOTE(JSON_EXTRACT(data, '$.trial.ends_at'))`

    return await db
      .selectFrom('Subscriptions')
      .where('status', '=', 'active')
      .where('user_id', 'is not', null)
      .where((eb) => eb.or([eb('cancel_on_renewal', 'is', null), eb('cancel_on_renewal', '=', 0)]))
      .where(endsAt, '>', now.toISOString())
      .where(endsAt, '<=', until.toISOString())
      .where(sql`JSON_EXTRACT(data, '$.trial.reminder_sent_at')`, 'is', null)
      .selectAll()
      .execute()
  }

  /**
   * Stamp `data.trial.reminder_sent_at`, the trial-ending reminder's idempotency key. JSON_SET in one
   * statement leaves the rest of `data` untouched, and the `IS NULL` guard makes a second stamp a
   * no-op. Returns whether this call wrote the stamp.
   */
  async stampTrialReminderSent(id: number, sentAt: Date, trx?: TransactionContext): Promise<boolean> {
    const db = trx ?? this.db
    const result = await db
      .updateTable('Subscriptions')
      .set({
        data: sql`JSON_SET(data, '$.trial.reminder_sent_at', ${sentAt.toISOString()})`,
        updatedAt: sentAt,
      })
      .where('subscription_id', '=', id)
      .where(sql`JSON_EXTRACT(data, '$.trial.reminder_sent_at')`, 'is', null)
      .executeTakeFirst()
    return Number(result.numUpdatedRows) > 0
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
export const createSubscriptionRepository = (db: Kysely<DB>): SubscriptionRepository => {
  return new SubscriptionRepository(db)
}
