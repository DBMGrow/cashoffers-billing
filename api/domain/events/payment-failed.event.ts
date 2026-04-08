import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'

/**
 * Event emitted when a payment fails.
 */
export interface PaymentFailedPayload {
  /** User ID who attempted the payment */
  userId: number
  /** User email */
  email: string
  /** Amount attempted in cents */
  amount: number
  /** Currency code (e.g., 'USD') */
  currency?: string
  /** Card ID that was attempted */
  cardId?: string
  /** Last 4 digits of card */
  cardLast4?: string
  /** Payment provider (e.g., 'Square') */
  paymentProvider: string
  /** Related subscription ID if this is a subscription payment */
  subscriptionId?: number
  /** Related product ID */
  productId?: number
  /** Human-readable subscription/product name */
  productName?: string
  /** Type of payment that failed (purchase, renewal, unlock) */
  paymentType: string
  /** Square environment used (production or sandbox) */
  environment?: 'production' | 'sandbox'
  /** Error message from payment provider */
  errorMessage: string
  /** Error code from payment provider */
  errorCode?: string
  /** Category of error (card_declined, insufficient_funds, etc.) */
  errorCategory?: string
  /** Whether this will be retried */
  willRetry?: boolean
  /** Next retry date if applicable */
  nextRetryDate?: Date
  /** Number of retry attempts so far */
  attemptNumber?: number
  /** What triggered this payment attempt */
  triggerSource?: 'cron' | 'card_update'
}

export class PaymentFailedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'PaymentFailed'
  readonly occurredAt: Date
  readonly aggregateId: number | string
  readonly aggregateType = 'Payment'
  readonly payload: PaymentFailedPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: PaymentFailedPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    // Use subscription ID as aggregate ID if available, otherwise use email as identifier
    this.aggregateId = payload.subscriptionId || payload.email
    this.payload = payload
    this.metadata = metadata
  }

  static create(
    payload: PaymentFailedPayload,
    metadata?: Record<string, unknown>
  ): PaymentFailedEvent {
    return new PaymentFailedEvent(payload, metadata)
  }
}
