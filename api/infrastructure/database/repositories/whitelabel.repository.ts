import { Kysely, Selectable, Insertable, Updateable } from 'kysely'
import type { DB, Whitelabels } from '@api/lib/db'

/**
 * Whitelabel Repository Implementation
 * Handles whitelabel records using Kysely
 */
export class WhitelabelRepository {
  constructor(private db: Kysely<DB>) {}

  async findById(id: number | bigint): Promise<Selectable<Whitelabels> | null> {
    const result = await this.db
      .selectFrom('Whitelabels')
      .where('whitelabel_id', '=', Number(id))
      .selectAll()
      .executeTakeFirst()

    return result || null
  }

  async findAll(criteria?: Partial<Selectable<Whitelabels>>): Promise<Selectable<Whitelabels>[]> {
    let query = this.db.selectFrom('Whitelabels').selectAll()

    if (criteria) {
      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.where(key as any, '=', value)
        }
      })
    }

    return await query.execute()
  }

  async findOne(criteria: Partial<Selectable<Whitelabels>>): Promise<Selectable<Whitelabels> | null> {
    let query = this.db.selectFrom('Whitelabels').selectAll()

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined) {
        query = query.where(key as any, '=', value)
      }
    })

    const result = await query.executeTakeFirst()
    return result || null
  }

  async create(data: Insertable<Whitelabels>): Promise<Selectable<Whitelabels>> {
    const result = await this.db
      .insertInto('Whitelabels')
      .values(data)
      .executeTakeFirstOrThrow()

    const created = await this.findById(Number(result.insertId))
    if (!created) {
      throw new Error('Failed to retrieve created whitelabel')
    }

    return created
  }

  async update(id: number | bigint, data: Updateable<Whitelabels>): Promise<Selectable<Whitelabels>> {
    await this.db
      .updateTable('Whitelabels')
      .set(data)
      .where('whitelabel_id', '=', Number(id))
      .executeTakeFirstOrThrow()

    const updated = await this.findById(id)
    if (!updated) {
      throw new Error('Failed to retrieve updated whitelabel')
    }

    return updated
  }

  async delete(id: number | bigint): Promise<void> {
    await this.db
      .deleteFrom('Whitelabels')
      .where('whitelabel_id', '=', Number(id))
      .executeTakeFirstOrThrow()
  }

  // Custom methods specific to WhitelabelRepository

  async getSuspensionBehavior(whitelabelId: number): Promise<'DOWNGRADE_TO_FREE' | 'DEACTIVATE_USER' | null> {
    const result = await this.db
      .selectFrom('Whitelabels')
      .where('whitelabel_id', '=', whitelabelId)
      .select('suspension_behavior')
      .executeTakeFirst()

    return result?.suspension_behavior || null
  }

  async findByCode(code: string): Promise<Selectable<Whitelabels> | null> {
    const result = await this.db
      .selectFrom('Whitelabels')
      .where('code', '=', code)
      .selectAll()
      .executeTakeFirst()

    return result || null
  }
}

/**
 * Create a whitelabel repository
 */
export const createWhitelabelRepository = (db: Kysely<DB>): WhitelabelRepository => {
  return new WhitelabelRepository(db)
}
