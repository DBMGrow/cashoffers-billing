import { Selectable, Insertable, Updateable } from 'kysely'

/**
 * Base Repository Interface
 * Generic CRUD operations for all repositories
 * T is the table type (e.g., Products, Subscriptions)
 */
export interface IRepository<T> {
  /**
   * Find a record by ID
   */
  findById(id: number | bigint): Promise<Selectable<T> | null>

  /**
   * Find all records matching criteria
   */
  findAll(criteria?: Partial<Selectable<T>>): Promise<Selectable<T>[]>

  /**
   * Find one record matching criteria
   */
  findOne(criteria: Partial<Selectable<T>>): Promise<Selectable<T> | null>

  /**
   * Create a new record
   */
  create(data: Insertable<T>): Promise<Selectable<T>>

  /**
   * Update a record by ID
   */
  update(id: number | bigint, data: Updateable<T>): Promise<Selectable<T>>

  /**
   * Delete a record by ID
   */
  delete(id: number | bigint): Promise<void>
}

/**
 * Query options for filtering and pagination
 */
export interface QueryOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}
