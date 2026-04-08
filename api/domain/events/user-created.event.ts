import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'

/**
 * Event emitted when a new user is created during the purchase flow.
 */
export interface UserCreatedPayload {
  /** New user ID */
  userId: number
  /** User email */
  email: string
  /** First name */
  firstName?: string
  /** Last name */
  lastName?: string
  /** How the user was created (via purchase flow, admin, etc.) */
  creationSource: string
  /** Related subscription ID if created during subscription purchase */
  subscriptionId?: number
  /** Related product ID */
  productId?: number
}

export class UserCreatedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'UserCreated'
  readonly occurredAt: Date
  readonly aggregateId: number
  readonly aggregateType = 'User'
  readonly payload: UserCreatedPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: UserCreatedPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.userId
    this.payload = payload
    this.metadata = metadata
  }

  static create(
    payload: UserCreatedPayload,
    metadata?: Record<string, unknown>
  ): UserCreatedEvent {
    return new UserCreatedEvent(payload, metadata)
  }
}
