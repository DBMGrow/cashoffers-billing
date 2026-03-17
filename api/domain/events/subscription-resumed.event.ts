import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'
import type { ProductData } from '@api/domain/types/product-data.types'

export interface SubscriptionResumedPayload {
  subscriptionId: number
  userId: number
  email?: string
  subscriptionName?: string
  newRenewalDate?: Date
  productData?: ProductData
}

export class SubscriptionResumedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'SubscriptionResumed'
  readonly occurredAt: Date
  readonly aggregateId: number
  readonly aggregateType = 'Subscription'
  readonly payload: SubscriptionResumedPayload
  readonly metadata?: Record<string, unknown>

  constructor(payload: SubscriptionResumedPayload, metadata?: Record<string, unknown>) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.subscriptionId
    this.payload = payload
    this.metadata = metadata
  }

  static create(payload: SubscriptionResumedPayload, metadata?: Record<string, unknown>): SubscriptionResumedEvent {
    return new SubscriptionResumedEvent(payload, metadata)
  }
}
