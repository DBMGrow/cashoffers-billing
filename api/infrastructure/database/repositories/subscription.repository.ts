import { Kysely, Selectable, Insertable, Updateable, UpdateObject, sql } from 'kysely'
import type { DB, Subscriptions } from '@api/lib/db'
import { TransactionContext } from '../transaction/transaction-manager.interface'

/**
 * A card-on-file trial's first-charge time (Desk #1350, `Subscriptions.data.trial.ends_at`). It is
 * always written by `toISOString()`, so comparing it to another ISO string is a time comparison. A
 * row with no trial marker yields NULL and drops out of every comparison.
 */
const trialEndsAt = sql<string>`JSON_UNQUOTE(JSON_EXTRACT(Subscriptions.data, '$.trial.ends_at'))`

/**
 * The trial has converted, or is converting right now (Desk #1350, D1). Converted is the
 * reconciliation's definition: a completed RENEWAL purchase request with `amount_charged > 0`.
 * Converting is a RENEWAL request in `CREATING_SUBSCRIPTION` or `FINALIZING`: the renewal use case
 * moves its request there after the charge and before it writes the next period's `renewal_date`,
 * so that write is the conversion and must not carry `ends_at` a period forward. Only valid inside
 * a statement on `Subscriptions`.
 */
const trialConvertedOrConverting = sql<boolean>`EXISTS (SELECT 1 FROM PurchaseRequests AS trial_pr WHERE trial_pr.subscription_id = Subscriptions.subscription_id AND trial_pr.request_type = 'RENEWAL' AND ((trial_pr.status = 'COMPLETED' AND trial_pr.amount_charged > 0) OR trial_pr.status IN ('CREATING_SUBSCRIPTION', 'FINALIZING')))`

/** `data.trial` is a JSON object: the row carries a card-on-file trial marker. */
const hasTrialMarker = sql<boolean>`JSON_TYPE(JSON_EXTRACT(Subscriptions.data, '$.trial')) = 'OBJECT'`

/**
 * The D1 invariant (Desk #1350): until a card-on-file trial converts, its first charge is its
 * `renewal_date`, so `data.trial.ends_at` says the same thing. When an update writes
 * `renewal_date`, the same statement rewrites `data` with JSON_SET of `ends_at` (ISO, as
 * `toISOString()` writes it) on a row whose `data.trial` is an object and that has not converted,
 * and leaves `data` as it was otherwise. MySQL evaluates the condition on the row it updates, so
 * there is no read-modify-write race. When the update also writes `data` (the renewal use case
 * writes the whole row), the new value is the one rewritten.
 */
export function withTrialEndFollowingRenewal(data: Updateable<Subscriptions>): UpdateObject<DB, 'Subscriptions'> {
  const renewal = data.renewal_date
  if (renewal == null) return data
  const renewalDate = renewal instanceof Date ? renewal : new Date(renewal as unknown as string)
  if (Number.isNaN(renewalDate.getTime())) return data

  const doc = data.data !== undefined ? sql`${data.data}` : sql.ref('Subscriptions.data')
  return {
    ...data,
    data: sql<any>`CASE WHEN JSON_TYPE(JSON_EXTRACT(${doc}, '$.trial')) = 'OBJECT' AND NOT ${trialConvertedOrConverting} THEN JSON_SET(${doc}, '$.trial.ends_at', ${renewalDate.toISOString()}) ELSE ${doc} END`,
  }
}

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

    // Every billing writer of `renewal_date` comes through here, so a trial's end follows it (D1)
    await db
      .updateTable('Subscriptions')
      .set(withTrialEndFollowingRenewal(data))
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

  /**
   * Card-on-file free trials (Desk #1350) that have not reached their first charge yet: active, bound
   * to a user, `data.trial.ends_at` after `now`. Feeds the daily report's `active_trials` and
   * `ending_in_7d`.
   */
  async findActiveTrials(now: Date = new Date(), trx?: TransactionContext): Promise<Selectable<Subscriptions>[]> {
    const db = trx ?? this.db
    return await db
      .selectFrom('Subscriptions')
      .where('Subscriptions.status', '=', 'active')
      .where('Subscriptions.user_id', 'is not', null)
      .where(trialEndsAt, '>', now.toISOString())
      .selectAll('Subscriptions')
      .execute()
  }

  /**
   * The trial invariant (Desk #1350): every live trial that will be charged has a card to charge.
   * Returns active trials still before their first charge, not cancel-on-renewal (those will never
   * be charged), whose user has no `UserCards` row with a card id. Each one is a renewal that will
   * fail on day N.
   */
  async findTrialsWithoutCard(now: Date = new Date(), trx?: TransactionContext): Promise<Selectable<Subscriptions>[]> {
    const db = trx ?? this.db
    return await db
      .selectFrom('Subscriptions')
      .where('Subscriptions.status', '=', 'active')
      .where('Subscriptions.user_id', 'is not', null)
      .where((eb) => eb.or([eb('Subscriptions.cancel_on_renewal', 'is', null), eb('Subscriptions.cancel_on_renewal', '=', 0)]))
      .where(trialEndsAt, '>', now.toISOString())
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('UserCards')
              .select('UserCards.id')
              .whereRef('UserCards.user_id', '=', 'Subscriptions.user_id')
              .where('UserCards.card_id', 'is not', null)
              .where('UserCards.card_id', '!=', '')
          )
        )
      )
      .selectAll('Subscriptions')
      .execute()
  }

  /**
   * Trials (Desk #1350) whose first charge was due more than 24 hours before `now` and that did
   * nothing visible: no completed paid RENEWAL purchase request (the "first paid renewal" of
   * `api/database/reports/promo-redemptions.sql`), not cancelled or cancel-on-renewal, and no
   * payment failure on the retry ladder. The 24 hours give the cron a day to take the charge.
   * `renewal_date` must have passed the cutoff too: the cron charges on `renewal_date`, so a trial
   * whose renewal was moved later is not due, whatever `ends_at` says (D1, AC22).
   */
  async findEndedTrialsUnreconciled(now: Date = new Date(), trx?: TransactionContext): Promise<Selectable<Subscriptions>[]> {
    const db = trx ?? this.db
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    return await db
      .selectFrom('Subscriptions')
      .where(trialEndsAt, '<', cutoff.toISOString())
      .where('Subscriptions.renewal_date', '<', cutoff)
      .where((eb) => eb.or([eb('Subscriptions.status', 'is', null), eb('Subscriptions.status', '!=', 'cancelled')]))
      .where((eb) => eb.or([eb('Subscriptions.cancel_on_renewal', 'is', null), eb('Subscriptions.cancel_on_renewal', '=', 0)]))
      .where('Subscriptions.payment_failure_count', '=', 0)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('PurchaseRequests')
              .select('PurchaseRequests.request_id')
              .whereRef('PurchaseRequests.subscription_id', '=', 'Subscriptions.subscription_id')
              .where('PurchaseRequests.request_type', '=', 'RENEWAL')
              .where('PurchaseRequests.status', '=', 'COMPLETED')
              .where('PurchaseRequests.amount_charged', '>', 0)
          )
        )
      )
      .selectAll('Subscriptions')
      .execute()
  }

  /**
   * Card-on-file trials (Desk #1350) that have not converted (D1): a `data.trial` object, not
   * cancelled, and no completed paid RENEWAL nor one in the middle of converting. For each of these
   * `data.trial.ends_at` must equal `renewal_date`; the cron's drift check compares the two
   * (`trialDateDrift`) and logs any row where a writer moved one without the other.
   */
  async findUnconvertedTrials(trx?: TransactionContext): Promise<Selectable<Subscriptions>[]> {
    const db = trx ?? this.db
    return await db
      .selectFrom('Subscriptions')
      .where(hasTrialMarker)
      .where((eb) => eb.or([eb('Subscriptions.status', 'is', null), eb('Subscriptions.status', '!=', 'cancelled')]))
      .where(sql<boolean>`NOT ${trialConvertedOrConverting}`)
      .selectAll('Subscriptions')
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
export const createSubscriptionRepository = (db: Kysely<DB>): SubscriptionRepository => {
  return new SubscriptionRepository(db)
}
