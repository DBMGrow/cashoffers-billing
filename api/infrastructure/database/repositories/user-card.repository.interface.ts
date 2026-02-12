import { Selectable } from 'kysely'
import { IRepository } from './repository.interface'
import type { UserCards } from '@api/lib/db'

/**
 * UserCard Repository Interface
 * Handles user payment card records
 */
export interface IUserCardRepository extends IRepository<UserCards> {
  /**
   * Find all cards for a user (optionally filter by environment)
   */
  findByUserId(
    userId: number,
    environment?: 'production' | 'sandbox'
  ): Promise<Selectable<UserCards>[]>

  /**
   * Find active cards for a user
   */
  findActiveByUserId(userId: number): Promise<Selectable<UserCards>[]>

  /**
   * Find card by Square card ID
   */
  findBySquareCardId(squareCardId: string): Promise<Selectable<UserCards> | null>

  /**
   * Deactivate all cards for a user
   */
  deactivateAllForUser(userId: number): Promise<void>

  /**
   * Mark card as default
   */
  setAsDefault(userId: number, cardId: number): Promise<Selectable<UserCards>>
}
