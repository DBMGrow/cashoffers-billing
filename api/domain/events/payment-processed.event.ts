import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@/infrastructure/events/event-bus.interface'

/**
 * Event emitted when a payment is successfully processed.
 */
export interface PaymentProcessedPayload {
  /** Transaction ID in our system */
  transactionId: number
  /** External payment provider transaction ID */
  externalTransactionId: string
  /** User ID who made the payment */
  userId: number
  /** User email */
  email: string
  /** Amount charged in cents */
  amount: number
  /** Currency code (e.g., 'USD') */
  currency?: string
  /** Card ID used for payment */
  cardId?: string
  /** Last 4 digits of card */
  cardLast4?: string
  /** Payment provider (e.g., 'Square') */
  paymentProvider: string
  /** Related subscription ID if this is a subscription payment */
  subscriptionId?: number
  /** Related product ID */
  productId?: number
  /** Type of payment (purchase, renewal, unlock, refund) */
  paymentType: string
  /** Square environment used (production or sandbox) */
  environment?: 'production' | 'sandbox'
  /** Line items for multi-part charges */
  lineItems?: Array<{
    description: string
    amount: number
  }>
}

export class PaymentProcessedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'PaymentProcessed'
  readonly occurredAt: Date
  readonly aggregateId: number
  readonly aggregateType = 'Payment'
  readonly payload: PaymentProcessedPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: PaymentProcessedPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.transactionId
    this.payload = payload
    this.metadata = metadata
  }

  static create(
    payload: PaymentProcessedPayload,
    metadata?: Record<string, unknown>
  ): PaymentProcessedEvent {
    return new PaymentProcessedEvent(payload, metadata)
  }
}
