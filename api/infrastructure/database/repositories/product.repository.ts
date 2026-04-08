import { Kysely, Selectable, Insertable, Updateable } from 'kysely'
import type { DB, Products } from '@api/lib/db'

/**
 * Product Repository Implementation
 * Handles product records using Kysely
 */
export class ProductRepository {
  constructor(private db: Kysely<DB>) {}

  async findById(id: number | bigint): Promise<Selectable<Products> | null> {
    const result = await this.db
      .selectFrom('Products')
      .where('product_id', '=', Number(id))
      .selectAll()
      .executeTakeFirst()

    return result || null
  }

  async findAll(criteria?: Partial<Selectable<Products>>): Promise<Selectable<Products>[]> {
    let query = this.db.selectFrom('Products').selectAll()

    if (criteria) {
      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.where(key as any, '=', value)
        }
      })
    }

    return await query.execute()
  }

  async findOne(criteria: Partial<Selectable<Products>>): Promise<Selectable<Products> | null> {
    let query = this.db.selectFrom('Products').selectAll()

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined) {
        query = query.where(key as any, '=', value)
      }
    })

    const result = await query.executeTakeFirst()
    return result || null
  }

  async create(data: Insertable<Products>): Promise<Selectable<Products>> {
    const result = await this.db
      .insertInto('Products')
      .values(data)
      .executeTakeFirstOrThrow()

    const created = await this.findById(Number(result.insertId))
    if (!created) {
      throw new Error('Failed to retrieve created product')
    }

    return created
  }

  async update(id: number | bigint, data: Updateable<Products>): Promise<Selectable<Products>> {
    await this.db
      .updateTable('Products')
      .set(data)
      .where('product_id', '=', Number(id))
      .executeTakeFirstOrThrow()

    const updated = await this.findById(id)
    if (!updated) {
      throw new Error('Failed to retrieve updated product')
    }

    return updated
  }

  async delete(id: number | bigint): Promise<void> {
    await this.db
      .deleteFrom('Products')
      .where('product_id', '=', Number(id))
      .executeTakeFirstOrThrow()
  }

  // Custom methods specific to ProductRepository

  async findActive(): Promise<Selectable<Products>[]> {
    // Note: active field doesn't exist in Products schema
    // Return all products for now, or filter by product_type if needed
    return await this.db
      .selectFrom('Products')
      .where('product_type', '!=', 'none')
      .selectAll()
      .orderBy('product_name', 'asc')
      .execute()
  }

  async findByName(name: string): Promise<Selectable<Products> | null> {
    const result = await this.db
      .selectFrom('Products')
      .where('product_name', '=', name)
      .selectAll()
      .executeTakeFirst()

    return result || null
  }

  async findByDuration(duration: string): Promise<Selectable<Products>[]> {
    // Note: duration field doesn't exist in Products schema
    // This may need to be implemented via joining with Subscriptions or stored in data field
    return []
  }
}

/**
 * Create a product repository
 */
export const createProductRepository = (db: Kysely<DB>): ProductRepository => {
  return new ProductRepository(db)
}
