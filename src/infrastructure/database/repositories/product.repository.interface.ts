import { IRepository } from './repository.interface'
import type { Products } from '@/lib/db'

/**
 * Product Repository Interface
 * Handles product records
 */
export interface IProductRepository extends IRepository<Products> {
  /**
   * Find active products
   */
  findActive(): Promise<Products[]>

  /**
   * Find product by name
   */
  findByName(name: string): Promise<Products | null>

  /**
   * Find products by duration
   */
  findByDuration(duration: string): Promise<Products[]>
}
