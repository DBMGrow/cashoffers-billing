import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'

/**
 * Event emitted when a user unlocks a property for viewing.
 */
export interface PropertyUnlockedPayload {
  /** Transaction ID in our system */
  transactionId: number
  /** User ID who unlocked the property */
  userId: number
  /** User email */
  email: string
  /** Property ID that was unlocked */
  propertyId: number
  /** Property address */
  propertyAddress?: string
  /** Property photo URL */
  propertyImageUrl?: string
  /** Amount charged in cents */
  amount: number
  /** Currency code (e.g., 'USD') */
  currency?: string
  /** External payment provider transaction ID */
  externalTransactionId: string
  /** Card ID used for payment */
  cardId?: string
  /** Last 4 digits of card */
  cardLast4?: string
  /** Payment provider (e.g., 'Square') */
  paymentProvider: string
  /** Product ID used for unlock */
  productId?: number
  /** Product name */
  productName?: string
}

export class PropertyUnlockedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'PropertyUnlocked'
  readonly occurredAt: Date
  readonly aggregateId: number
  readonly aggregateType = 'PropertyUnlock'
  readonly payload: PropertyUnlockedPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: PropertyUnlockedPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.propertyId
    this.payload = payload
    this.metadata = metadata
  }

  static create(
    payload: PropertyUnlockedPayload,
    metadata?: Record<string, unknown>
  ): PropertyUnlockedEvent {
    return new PropertyUnlockedEvent(payload, metadata)
  }
}
