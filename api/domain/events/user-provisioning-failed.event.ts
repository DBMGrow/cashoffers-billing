import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'

/**
 * Event emitted when user account provisioning fails after a successful payment
 * and subscription creation.
 *
 * The subscription exists and the customer was charged. The user account was NOT
 * created. Manual intervention is required to create the user and bind them to
 * the subscription.
 */
export interface UserProvisioningFailedPayload {
  /** The subscription that was created (customer was charged) */
  subscriptionId: number
  /** Purchase request ID for audit trail */
  purchaseRequestId: number
  /** Customer email — used to manually create the user */
  email: string
  /** Product ID the customer purchased */
  productId: number
  /** Card ID that was created and charged */
  cardId: string
  /** The error that caused provisioning to fail */
  errorMessage: string
  occurredAt: Date
}

export class UserProvisioningFailedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'UserProvisioningFailed'
  readonly occurredAt: Date
  readonly aggregateId: number
  readonly aggregateType = 'Subscription'
  readonly payload: UserProvisioningFailedPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: UserProvisioningFailedPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = payload.occurredAt
    this.aggregateId = payload.subscriptionId
    this.payload = payload
    this.metadata = metadata
  }

  static create(
    payload: Omit<UserProvisioningFailedPayload, 'occurredAt'>,
    metadata?: Record<string, unknown>
  ): UserProvisioningFailedEvent {
    return new UserProvisioningFailedEvent({ ...payload, occurredAt: new Date() }, metadata)
  }
}
