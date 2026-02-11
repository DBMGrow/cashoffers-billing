import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@/infrastructure/events/event-bus.interface'

/**
 * Event emitted when a subscription is marked for downgrade on renewal.
 */
export interface SubscriptionDowngradedPayload {
  subscriptionId: number
  userId: number
  email?: string
  currentSubscriptionName?: string
  /** Target downgrade product (if known) */
  targetProductId?: number
  targetProductName?: string
  /** Reason for downgrade */
  reason?: string
  /** Who initiated the downgrade (user, admin) */
  downgradedBy?: 'user' | 'admin'
  /** When the downgrade will take effect (next renewal date) */
  effectiveDate?: Date
  /** Whether this is marked for downgrade on renewal */
  downgradeOnRenewal: boolean
}

export class SubscriptionDowngradedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'SubscriptionDowngraded'
  readonly occurredAt: Date
  readonly aggregateId: number
  readonly aggregateType = 'Subscription'
  readonly payload: SubscriptionDowngradedPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: SubscriptionDowngradedPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.subscriptionId
    this.payload = payload
    this.metadata = metadata
  }

  static create(
    payload: SubscriptionDowngradedPayload,
    metadata?: Record<string, unknown>
  ): SubscriptionDowngradedEvent {
    return new SubscriptionDowngradedEvent(payload, metadata)
  }
}
