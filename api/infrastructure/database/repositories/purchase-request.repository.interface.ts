import { Selectable } from 'kysely'
import { PurchaseRequests } from '@api/lib/db'
import { IRepository, TransactionContext } from './repository.interface'
import { PurchaseRequestResults } from '@api/domain/entities/purchase-request'

/**
 * PurchaseRequest Repository Interface
 * Extends base repository with purchase-request-specific operations
 */
export interface IPurchaseRequestRepository extends IRepository<PurchaseRequests> {
  /**
   * Find a purchase request by its UUID (for idempotency)
   */
  findByUuid(uuid: string, trx?: TransactionContext): Promise<Selectable<PurchaseRequests> | null>

  /**
   * Find all purchase requests with a specific status
   */
  findByStatus(status: string, trx?: TransactionContext): Promise<Selectable<PurchaseRequests>[]>

  /**
   * Find purchase requests that are due for retry
   */
  findDueForRetry(date: Date, trx?: TransactionContext): Promise<Selectable<PurchaseRequests>[]>

  /**
   * Find all purchase requests for an email address
   */
  findByEmail(email: string, trx?: TransactionContext): Promise<Selectable<PurchaseRequests>[]>

  /**
   * Find purchase requests associated with a subscription
   */
  findBySubscriptionId(subscriptionId: number, trx?: TransactionContext): Promise<Selectable<PurchaseRequests>[]>

  /**
   * Mark a purchase request as processing (started)
   */
  markAsProcessing(id: number, trx?: TransactionContext): Promise<Selectable<PurchaseRequests>>

  /**
   * Mark a purchase request as completed with results
   */
  markAsCompleted(
    id: number,
    results: PurchaseRequestResults,
    startedAt: Date,
    trx?: TransactionContext
  ): Promise<Selectable<PurchaseRequests>>

  /**
   * Mark a purchase request as failed with error information
   */
  markAsFailed(
    id: number,
    reason: string,
    errorCode?: string,
    trx?: TransactionContext
  ): Promise<Selectable<PurchaseRequests>>

  /**
   * Schedule a retry for a failed purchase request
   */
  scheduleRetry(
    id: number,
    nextRetryAt: Date,
    trx?: TransactionContext
  ): Promise<Selectable<PurchaseRequests>>

  /**
   * Update the status of a purchase request
   */
  updateStatus(
    id: number,
    status: string,
    trx?: TransactionContext
  ): Promise<Selectable<PurchaseRequests>>
}
