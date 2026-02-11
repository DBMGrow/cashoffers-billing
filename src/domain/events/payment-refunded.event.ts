import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@/infrastructure/events/event-bus.interface'

/**
 * Event emitted when a payment is refunded.
 */
export interface PaymentRefundedPayload {
  /** Transaction ID in our system */
  transactionId: number
  /** External payment provider refund ID */
  externalRefundId: string
  /** Original payment transaction ID */
  originalTransactionId: number
  /** External payment provider original transaction ID */
  externalPaymentId: string
  /** User ID who received the refund */
  userId: number
  /** User email */
  email: string
  /** Amount refunded in cents */
  amount: number
  /** Currency code (e.g., 'USD') */
  currency?: string
  /** Payment provider (e.g., 'Square') */
  paymentProvider: string
  /** Reason for refund */
  reason?: string
  /** Related subscription ID if this was a subscription payment */
  subscriptionId?: number
  /** Related product ID */
  productId?: number
  /** Admin user ID who initiated the refund */
  refundedBy?: number
}

export class PaymentRefundedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'PaymentRefunded'
  readonly occurredAt: Date
  readonly aggregateId: number
  readonly aggregateType = 'Payment'
  readonly payload: PaymentRefundedPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: PaymentRefundedPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.transactionId
    this.payload = payload
    this.metadata = metadata
  }

  static create(
    payload: PaymentRefundedPayload,
    metadata?: Record<string, unknown>
  ): PaymentRefundedEvent {
    return new PaymentRefundedEvent(payload, metadata)
  }
}
