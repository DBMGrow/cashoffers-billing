import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'
import type { ProductData } from '@api/domain/types/product-data.types'

export interface SubscriptionUpgradedPayload {
  subscriptionId: number
  userId: number
  email?: string
  fromProductData?: ProductData
  toProductData?: ProductData
  newProductId?: number
  newPlanName?: string
  newAmount?: number
  proratedCharge?: number
  transactionId?: string
  renewalDate?: Date
  environment?: 'production' | 'sandbox'
}

export class SubscriptionUpgradedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'SubscriptionUpgraded'
  readonly occurredAt: Date
  readonly aggregateId: number
  readonly aggregateType = 'Subscription'
  readonly payload: SubscriptionUpgradedPayload
  readonly metadata?: Record<string, unknown>

  constructor(payload: SubscriptionUpgradedPayload, metadata?: Record<string, unknown>) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.subscriptionId
    this.payload = payload
    this.metadata = metadata
  }

  static create(payload: SubscriptionUpgradedPayload, metadata?: Record<string, unknown>): SubscriptionUpgradedEvent {
    return new SubscriptionUpgradedEvent(payload, metadata)
  }
}
