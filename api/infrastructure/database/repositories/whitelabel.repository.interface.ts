import { Selectable } from 'kysely'
import { IRepository } from './repository.interface'
import type { Whitelabels } from '@/lib/db'

/**
 * Whitelabel Repository Interface
 * Handles whitelabel records
 */
export interface IWhitelabelRepository extends IRepository<Whitelabels> {
  /**
   * Get the suspension behavior for a specific whitelabel
   * @param whitelabelId The whitelabel ID
   * @returns The suspension behavior or null if not found
   */
  getSuspensionBehavior(whitelabelId: number): Promise<'DOWNGRADE_TO_FREE' | 'DEACTIVATE_USER' | null>

  /**
   * Find whitelabel by code
   * @param code The whitelabel code
   * @returns The whitelabel record or null if not found
   */
  findByCode(code: string): Promise<Selectable<Whitelabels> | null>
}
