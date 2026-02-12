import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'

/**
 * Event emitted when an existing subscription is successfully renewed.
 */
export interface SubscriptionRenewedPayload {
  subscriptionId: number
  userId: number
  email: string
  productId: number
  productName: string
  amount: number
  /** Transaction ID for the renewal payment */
  transactionId?: number
  /** Card ID used for the renewal */
  cardId?: string
  /** Previous renewal date */
  previousRenewalDate?: Date
  /** New next renewal date */
  nextRenewalDate: Date
  /** Square environment used (production or sandbox) */
  environment?: 'production' | 'sandbox'
  /** Number of renewal attempts (for retry tracking) */
  attemptNumber?: number
  /** Whether this was a retry after a failed attempt */
  wasRetry?: boolean
}

export class SubscriptionRenewedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'SubscriptionRenewed'
  readonly occurredAt: Date
  readonly aggregateId: number
  readonly aggregateType = 'Subscription'
  readonly payload: SubscriptionRenewedPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: SubscriptionRenewedPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.subscriptionId
    this.payload = payload
    this.metadata = metadata
  }

  static create(
    payload: SubscriptionRenewedPayload,
    metadata?: Record<string, unknown>
  ): SubscriptionRenewedEvent {
    return new SubscriptionRenewedEvent(payload, metadata)
  }
}
