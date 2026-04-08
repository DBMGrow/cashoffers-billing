import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'

/**
 * Event emitted when a subscription is paused/suspended.
 */
export interface SubscriptionPausedPayload {
  subscriptionId: number
  userId: number
  email?: string
  subscriptionName?: string
  /** Reason for pause (user_request, payment_failed, etc.) */
  reason?: string
  /** Who initiated the pause (user, admin, system) */
  pausedBy?: 'user' | 'admin' | 'system'
  /** Previous status before pause */
  previousStatus?: string
}

export class SubscriptionPausedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'SubscriptionPaused'
  readonly occurredAt: Date
  readonly aggregateId: number
  readonly aggregateType = 'Subscription'
  readonly payload: SubscriptionPausedPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: SubscriptionPausedPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.subscriptionId
    this.payload = payload
    this.metadata = metadata
  }

  static create(
    payload: SubscriptionPausedPayload,
    metadata?: Record<string, unknown>
  ): SubscriptionPausedEvent {
    return new SubscriptionPausedEvent(payload, metadata)
  }
}
