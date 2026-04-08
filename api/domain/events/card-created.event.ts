import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'

/**
 * Event emitted when a new payment card is created for a user.
 */
export interface CardCreatedPayload {
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
  /** Square environment used (production or sandbox) */
  environment?: 'production' | 'sandbox'
  /** Related subscription ID if created during subscription purchase */
  subscriptionId?: number
  /** Whether this is the user's default card */
  isDefault?: boolean
}

export class CardCreatedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'CardCreated'
  readonly occurredAt: Date
  readonly aggregateId: string
  readonly aggregateType = 'Card'
  readonly payload: CardCreatedPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: CardCreatedPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.cardId
    this.payload = payload
    this.metadata = metadata
  }

  static create(
    payload: CardCreatedPayload,
    metadata?: Record<string, unknown>
  ): CardCreatedEvent {
    return new CardCreatedEvent(payload, metadata)
  }
}
