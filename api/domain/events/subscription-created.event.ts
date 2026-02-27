import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'

/**
 * Event emitted when a new subscription is successfully created.
 */
export interface SubscriptionCreatedPayload {
  subscriptionId: number
  userId: number
  email: string
  productId: number
  productName: string
  amount: number
  /** Initial charge amount (may differ from subscription amount if prorated) */
  initialChargeAmount?: number
  /** Internal transaction ID if payment was processed */
  transactionId?: number
  /** External payment provider transaction ID (e.g. Square payment ID) */
  externalTransactionId?: string
  /** Card ID used for the subscription */
  cardId?: string
  /** Whether a new user was created as part of this subscription */
  userWasCreated?: boolean
  /** Whether a new card was created */
  cardWasCreated?: boolean
  /** Next renewal date */
  nextRenewalDate?: Date
  /** Square environment used (production or sandbox) */
  environment?: 'production' | 'sandbox'
  /** Source of the subscription (API, CRON, ADMIN) */
  source?: string
  /** Line items for the initial charge */
  lineItems?: Array<{ description: string; amount: number }>
}

export class SubscriptionCreatedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'SubscriptionCreated'
  readonly occurredAt: Date
  readonly aggregateId: number
  readonly aggregateType = 'Subscription'
  readonly payload: SubscriptionCreatedPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: SubscriptionCreatedPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.subscriptionId
    this.payload = payload
    this.metadata = metadata
  }

  /**
   * Create event from domain data
   */
  static create(
    payload: SubscriptionCreatedPayload,
    metadata?: Record<string, unknown>
  ): SubscriptionCreatedEvent {
    return new SubscriptionCreatedEvent(payload, metadata)
  }
}
