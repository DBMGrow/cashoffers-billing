import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'

/**
 * Event emitted when a purchase request fails.
 */
export interface PurchaseRequestFailedPayload {
  /** Purchase request ID */
  purchaseRequestId: number
  /** Purchase request UUID */
  requestUuid: string
  /** Type of request (NEW_PURCHASE, RENEWAL, UPGRADE) */
  requestType: string
  /** Source of request (API, CRON, ADMIN) */
  source: string
  /** User ID if known */
  userId?: number
  /** User email */
  email: string
  /** Product ID */
  productId: number
  /** Subscription ID if this was a renewal */
  subscriptionId?: number
  /** Failure reason */
  failureReason: string
  /** Error code */
  errorCode: string
  /** Status where failure occurred */
  failureStatus: string
  /** Number of retry attempts */
  retryCount: number
  /** Whether retry is scheduled */
  retryScheduled: boolean
  /** Next retry date if scheduled */
  nextRetryDate?: Date
}

export class PurchaseRequestFailedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'PurchaseRequestFailed'
  readonly occurredAt: Date
  readonly aggregateId: number
  readonly aggregateType = 'PurchaseRequest'
  readonly payload: PurchaseRequestFailedPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: PurchaseRequestFailedPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.purchaseRequestId
    this.payload = payload
    this.metadata = metadata
  }

  static create(
    payload: PurchaseRequestFailedPayload,
    metadata?: Record<string, unknown>
  ): PurchaseRequestFailedEvent {
    return new PurchaseRequestFailedEvent(payload, metadata)
  }
}
