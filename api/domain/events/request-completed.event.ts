import { v4 as uuidv4 } from 'uuid'
import type { IDomainEvent } from '@/infrastructure/events/event-bus.interface'
import type { LogQueueEntry } from '@/infrastructure/logging/logging-context.interface'

/**
 * Event emitted when an HTTP request completes.
 * Used to trigger flushing of queued logs to database.
 */
export interface RequestCompletedPayload {
  /** Request ID */
  requestId: string
  /** User ID (if authenticated) */
  userId?: number
  /** HTTP status code */
  statusCode?: number
  /** Request duration in ms */
  duration?: number
  /** Queued logs to flush */
  queuedLogs: LogQueueEntry[]
}

export class RequestCompletedEvent implements IDomainEvent {
  readonly eventId: string
  readonly eventType = 'RequestCompleted'
  readonly occurredAt: Date
  readonly aggregateId: string
  readonly aggregateType = 'Request'
  readonly payload: RequestCompletedPayload
  readonly metadata?: Record<string, unknown>

  constructor(
    payload: RequestCompletedPayload,
    metadata?: Record<string, unknown>
  ) {
    this.eventId = uuidv4()
    this.occurredAt = new Date()
    this.aggregateId = payload.requestId
    this.payload = payload
    this.metadata = metadata
  }

  static create(
    payload: RequestCompletedPayload,
    metadata?: Record<string, unknown>
  ): RequestCompletedEvent {
    return new RequestCompletedEvent(payload, metadata)
  }
}
