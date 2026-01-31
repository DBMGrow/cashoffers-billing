/**
 * Base Repository Interface
 * Generic CRUD operations for all repositories
 */
export interface IRepository<T> {
  /**
   * Find a record by ID
   */
  findById(id: number | bigint): Promise<T | null>

  /**
   * Find all records matching criteria
   */
  findAll(criteria?: Partial<T>): Promise<T[]>

  /**
   * Find one record matching criteria
   */
  findOne(criteria: Partial<T>): Promise<T | null>

  /**
   * Create a new record
   */
  create(data: Partial<T>): Promise<T>

  /**
   * Update a record by ID
   */
  update(id: number | bigint, data: Partial<T>): Promise<T>

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
