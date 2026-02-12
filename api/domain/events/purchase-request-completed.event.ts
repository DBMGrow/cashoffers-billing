import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'

/**
 * Event emitted when a purchase request completes successfully.
 */
export interface PurchaseRequestCompletedPayload {
  /** Purchase request ID */
  purchaseRequestId: number
  /** Purchase request UUID */
  requestUuid: string
  /** Type of request (NEW_PURCHASE, RENEWAL, UPGRADE) */
  requestType: string
  /** Source of request (API, CRON, ADMIN) */
  source: string
  /** User ID */
  userId: number
  /** User email */
  email: string
  /** Product ID */
  productId: number
  /** Subscription ID created or renewed */
  subscriptionId: number
  /** Transaction ID */
  transactionId?: number
  /** Amount charged */
  amountCharged: number
  /** Card ID used */
  cardId?: string
  /** Whether a new user was created */
  userWasCreated: boolean
  /** Processing duration in milliseconds */
  processingDuration?: number
}

export class PurchaseRequestCompletedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'PurchaseRequestCompleted'
  readonly occurredAt: Date
  readonly aggregateId: number
  readonly aggregateType = 'PurchaseRequest'
  readonly payload: PurchaseRequestCompletedPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: PurchaseRequestCompletedPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.purchaseRequestId
    this.payload = payload
    this.metadata = metadata
  }

  static create(
    payload: PurchaseRequestCompletedPayload,
    metadata?: Record<string, unknown>
  ): PurchaseRequestCompletedEvent {
    return new PurchaseRequestCompletedEvent(payload, metadata)
  }
}
