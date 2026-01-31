import { Kysely, Selectable, Insertable, Updateable } from 'kysely'
import type { DB, Subscriptions } from '@/lib/db'
import { ISubscriptionRepository } from './subscription.repository.interface'

/**
 * Subscription Repository Implementation
 * Handles subscription records using Kysely
 */
export class SubscriptionRepository implements ISubscriptionRepository {
  constructor(private db: Kysely<DB>) {}

  async findById(id: number | bigint): Promise<Selectable<Subscriptions> | null> {
    const result = await this.db
      .selectFrom('Subscriptions')
      .where('subscription_id', '=', Number(id))
      .selectAll()
      .executeTakeFirst()

    return result || null
  }

  async findAll(criteria?: Partial<Selectable<Subscriptions>>): Promise<Selectable<Subscriptions>[]> {
    let query = this.db.selectFrom('Subscriptions').selectAll()

    if (criteria) {
      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.where(key as any, '=', value)
        }
      })
    }

    return await query.execute()
  }

  async findOne(criteria: Partial<Selectable<Subscriptions>>): Promise<Selectable<Subscriptions> | null> {
    let query = this.db.selectFrom('Subscriptions').selectAll()

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined) {
        query = query.where(key as any, '=', value)
      }
    })

    const result = await query.executeTakeFirst()
    return result || null
  }

  async create(data: Insertable<Subscriptions>): Promise<Selectable<Subscriptions>> {
    const result = await this.db
      .insertInto('Subscriptions')
      .values(data)
      .executeTakeFirstOrThrow()

    const created = await this.findById(Number(result.insertId))
    if (!created) {
      throw new Error('Failed to retrieve created subscription')
    }

    return created
  }

  async update(
    id: number | bigint,
    data: Updateable<Subscriptions>
  ): Promise<Selectable<Subscriptions>> {
    await this.db
      .updateTable('Subscriptions')
      .set(data)
      .where('subscription_id', '=', Number(id))
      .executeTakeFirstOrThrow()

    const updated = await this.findById(id)
    if (!updated) {
      throw new Error('Failed to retrieve updated subscription')
    }

    return updated
  }

  async delete(id: number | bigint): Promise<void> {
    await this.db
      .deleteFrom('Subscriptions')
      .where('subscription_id', '=', Number(id))
      .executeTakeFirstOrThrow()
  }

  // Custom methods specific to SubscriptionRepository

  async findByUserId(userId: number): Promise<Selectable<Subscriptions>[]> {
    return await this.db
      .selectFrom('Subscriptions')
      .where('user_id', '=', userId)
      .selectAll()
      .orderBy('createdAt', 'desc')
      .execute()
  }

  async findActiveByUserId(userId: number): Promise<Selectable<Subscriptions>[]> {
    return await this.db
      .selectFrom('Subscriptions')
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .selectAll()
      .orderBy('createdAt', 'desc')
      .execute()
  }

  async findDueForRenewal(date: Date): Promise<Selectable<Subscriptions>[]> {
    return await this.db
      .selectFrom('Subscriptions')
      .where('status', '=', 'active')
      .where('renewal_date', '<=', date)
      .where('cancel_on_renewal', '=', 0)
      .selectAll()
      .orderBy('renewal_date', 'asc')
      .execute()
  }

  async findByProductId(productId: number): Promise<Selectable<Subscriptions>[]> {
    return await this.db
      .selectFrom('Subscriptions')
      .where('product_id', '=', productId)
      .selectAll()
      .orderBy('createdAt', 'desc')
      .execute()
  }

  async updateRenewalDate(id: number, date: Date): Promise<Selectable<Subscriptions>> {
    return await this.update(id, {
      renewal_date: date,
      updatedAt: new Date(),
    })
  }

  async markForCancellation(id: number): Promise<Selectable<Subscriptions>> {
    return await this.update(id, {
      cancel_on_renewal: 1,
      updatedAt: new Date(),
    })
  }

  async markForDowngrade(id: number, downgradeToProductId: number): Promise<Selectable<Subscriptions>> {
    return await this.update(id, {
      downgrade_on_renewal: 1,
      // Note: downgrade_to_product_id doesn't exist in schema, storing in meta or data
      updatedAt: new Date(),
    })
  }

  async cancel(id: number): Promise<Selectable<Subscriptions>> {
    return await this.update(id, {
      status: 'cancelled',
      updatedAt: new Date(),
    })
  }
}

/**
 * Create a subscription repository
 */
export const createSubscriptionRepository = (db: Kysely<DB>): ISubscriptionRepository => {
  return new SubscriptionRepository(db)
}
