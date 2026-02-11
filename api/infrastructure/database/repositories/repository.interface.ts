import { Selectable, Insertable, Updateable, Kysely } from 'kysely'
import { DB } from '@/lib/db'

/**
 * Transaction Context - optional parameter for transactional operations
 */
export type TransactionContext = Kysely<DB>

/**
 * Base Repository Interface
 * Generic CRUD operations for all repositories
 * T is the table type (e.g., Products, Subscriptions)
 *
 * Write operations (create, update, delete) support optional transaction context.
 * When a transaction context is provided, the operation will be part of that transaction.
 */
export interface IRepository<T> {
  /**
   * Find a record by ID
   */
  findById(id: number | bigint, trx?: TransactionContext): Promise<Selectable<T> | null>

  /**
   * Find all records matching criteria
   */
  findAll(criteria?: Partial<Selectable<T>>, trx?: TransactionContext): Promise<Selectable<T>[]>

  /**
   * Find one record matching criteria
   */
  findOne(criteria: Partial<Selectable<T>>, trx?: TransactionContext): Promise<Selectable<T> | null>

  /**
   * Create a new record
   * @param data Record data to insert
   * @param trx Optional transaction context - if provided, operation will be part of this transaction
   */
  create(data: Insertable<T>, trx?: TransactionContext): Promise<Selectable<T>>

  /**
   * Update a record by ID
   * @param id Record ID
   * @param data Fields to update
   * @param trx Optional transaction context - if provided, operation will be part of this transaction
   */
  update(id: number | bigint, data: Updateable<T>, trx?: TransactionContext): Promise<Selectable<T>>

  /**
   * Delete a record by ID
   * @param id Record ID
   * @param trx Optional transaction context - if provided, operation will be part of this transaction
   */
  delete(id: number | bigint, trx?: TransactionContext): Promise<void>
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
