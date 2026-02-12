import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'

/**
 * Event emitted when a subscription is marked for cancellation on renewal.
 */
export interface SubscriptionCancelledPayload {
  subscriptionId: number
  userId: number
  email?: string
  subscriptionName?: string
  /** Reason for cancellation */
  reason?: string
  /** Who initiated the cancellation (user, admin) */
  cancelledBy?: 'user' | 'admin'
  /** When the subscription will actually end (next renewal date) */
  effectiveDate?: Date
  /** Whether this is immediate or on next renewal */
  cancelOnRenewal: boolean
}

export class SubscriptionCancelledEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'SubscriptionCancelled'
  readonly occurredAt: Date
  readonly aggregateId: number
  readonly aggregateType = 'Subscription'
  readonly payload: SubscriptionCancelledPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: SubscriptionCancelledPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.subscriptionId
    this.payload = payload
    this.metadata = metadata
  }

  static create(
    payload: SubscriptionCancelledPayload,
    metadata?: Record<string, unknown>
  ): SubscriptionCancelledEvent {
    return new SubscriptionCancelledEvent(payload, metadata)
  }
}
