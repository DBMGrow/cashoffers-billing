import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@/infrastructure/events/event-bus.interface'

/**
 * Event emitted when a payment card is updated for a user.
 */
export interface CardUpdatedPayload {
  /** Card ID in our system */
  cardId: string
  /** User ID who owns the card */
  userId: number
  /** User email */
  email: string
  /** Last 4 digits of card */
  cardLast4: string
  /** Card brand (Visa, Mastercard, etc.) */
  cardBrand?: string
  /** Expiration month */
  expirationMonth?: number
  /** Expiration year */
  expirationYear?: number
  /** External payment provider card ID */
  externalCardId: string
  /** Payment provider (e.g., 'Square') */
  paymentProvider: string
  /** Whether this is the user's default card */
  isDefault?: boolean
  /** Fields that were updated */
  updatedFields?: string[]
}

export class CardUpdatedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'CardUpdated'
  readonly occurredAt: Date
  readonly aggregateId: string
  readonly aggregateType = 'Card'
  readonly payload: CardUpdatedPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: CardUpdatedPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.cardId
    this.payload = payload
    this.metadata = metadata
  }

  static create(
    payload: CardUpdatedPayload,
    metadata?: Record<string, unknown>
  ): CardUpdatedEvent {
    return new CardUpdatedEvent(payload, metadata)
  }
}
