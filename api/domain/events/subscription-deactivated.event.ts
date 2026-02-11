import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@/infrastructure/events/event-bus.interface'

/**
 * Event emitted when a subscription is deactivated.
 * This should trigger premium deactivation, email notification, and audit logging.
 */
export interface SubscriptionDeactivatedPayload {
  subscriptionId: number
  userId: number
  email?: string
  subscriptionName?: string
  /** Reason for deactivation (manual, payment_failed, cancelled, etc.) */
  reason?: string
  /** Who initiated the deactivation (user, admin, system) */
  deactivatedBy?: 'user' | 'admin' | 'system'
  /** Previous status before deactivation */
  previousStatus?: string
}

export class SubscriptionDeactivatedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'SubscriptionDeactivated'
  readonly occurredAt: Date
  readonly aggregateId: number
  readonly aggregateType = 'Subscription'
  readonly payload: SubscriptionDeactivatedPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: SubscriptionDeactivatedPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.subscriptionId
    this.payload = payload
    this.metadata = metadata
  }

  static create(
    payload: SubscriptionDeactivatedPayload,
    metadata?: Record<string, unknown>
  ): SubscriptionDeactivatedEvent {
    return new SubscriptionDeactivatedEvent(payload, metadata)
  }
}
