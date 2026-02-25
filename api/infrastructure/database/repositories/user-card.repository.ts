import { Kysely, Selectable, Insertable, Updateable } from 'kysely'
import type { DB, UserCards } from '@api/lib/db'

/**
 * UserCard Repository Implementation
 * Handles user payment card records using Kysely
 */
export class UserCardRepository {
  constructor(private db: Kysely<DB>) {}

  async findById(id: number | bigint): Promise<Selectable<UserCards> | null> {
    const result = await this.db
      .selectFrom('UserCards')
      .where('id', '=', Number(id))
      .selectAll()
      .executeTakeFirst()

    return result || null
  }

  async findAll(criteria?: Partial<Selectable<UserCards>>): Promise<Selectable<UserCards>[]> {
    let query = this.db.selectFrom('UserCards').selectAll()

    if (criteria) {
      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.where(key as any, '=', value)
        }
      })
    }

    return await query.execute()
  }

  async findOne(criteria: Partial<Selectable<UserCards>>): Promise<Selectable<UserCards> | null> {
    let query = this.db.selectFrom('UserCards').selectAll()

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined) {
        query = query.where(key as any, '=', value)
      }
    })

    const result = await query.executeTakeFirst()
    return result || null
  }

  async create(data: Insertable<UserCards>): Promise<Selectable<UserCards>> {
    const result = await this.db
      .insertInto('UserCards')
      .values(data)
      .executeTakeFirstOrThrow()

    const created = await this.findById(Number(result.insertId))
    if (!created) {
      throw new Error('Failed to retrieve created user card')
    }

    return created
  }

  async update(id: number | bigint, data: Updateable<UserCards>): Promise<Selectable<UserCards>> {
    await this.db
      .updateTable('UserCards')
      .set(data)
      .where('id', '=', Number(id))
      .executeTakeFirstOrThrow()

    const updated = await this.findById(id)
    if (!updated) {
      throw new Error('Failed to retrieve updated user card')
    }

    return updated
  }

  async delete(id: number | bigint): Promise<void> {
    await this.db
      .deleteFrom('UserCards')
      .where('id', '=', Number(id))
      .executeTakeFirstOrThrow()
  }

  // Custom methods specific to UserCardRepository

  async findByUserId(
    userId: number,
    environment?: 'production' | 'sandbox'
  ): Promise<Selectable<UserCards>[]> {
    let query = this.db
      .selectFrom('UserCards')
      .where('user_id', '=', userId)
      .selectAll()
      .orderBy('createdAt', 'desc')

    // Optionally filter by environment
    if (environment) {
      query = query.where('square_environment', '=', environment)
    }

    return await query.execute()
  }

  async findActiveByUserId(userId: number): Promise<Selectable<UserCards>[]> {
    // Note: active field doesn't exist in UserCards schema
    // All cards are considered active by default
    return await this.findByUserId(userId)
  }

  async findBySquareCardId(squareCardId: string): Promise<Selectable<UserCards> | null> {
    const result = await this.db
      .selectFrom('UserCards')
      .where('card_id', '=', squareCardId)
      .selectAll()
      .executeTakeFirst()

    return result || null
  }

  async deactivateAllForUser(userId: number): Promise<void> {
    // Note: active field doesn't exist in UserCards schema
    // This method might need to delete cards or mark them in a different way
    // For now, this is a no-op
  }

  async setAsDefault(userId: number, cardId: number): Promise<Selectable<UserCards>> {
    // Note: is_default field doesn't exist in UserCards schema
    // This functionality may need to be implemented via a separate table or user preference
    const card = await this.findById(cardId)
    if (!card) {
      throw new Error('Card not found')
    }
    return card
  }
}

/**
 * Create a user card repository
 */
export const createUserCardRepository = (db: Kysely<DB>): UserCardRepository => {
  return new UserCardRepository(db)
}
