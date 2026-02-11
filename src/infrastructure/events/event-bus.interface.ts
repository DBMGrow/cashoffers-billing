/**
 * Base interface for all domain events in the system.
 * Events represent things that have happened in the domain.
 */
export interface IDomainEvent {
  /** Unique identifier for this event instance */
  eventId: string;

  /** Type of the event (e.g., "SubscriptionCreated", "PaymentProcessed") */
  eventType: string;

  /** When the event occurred */
  occurredAt: Date;

  /** ID of the aggregate root that emitted this event */
  aggregateId: string | number;

  /** Type of aggregate (e.g., "Subscription", "Payment") */
  aggregateType: string;

  /** Event-specific data */
  payload: any;

  /** Optional metadata (request ID, user agent, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Event handler interface - all handlers must implement this.
 */
export interface IEventHandler<T extends IDomainEvent = IDomainEvent> {
  /**
   * Handle the event. Should be idempotent when possible.
   * @throws Error for critical failures that should fail the operation
   * @returns Promise that resolves when handling is complete
   */
  handle(event: T): Promise<void>;
}

/**
 * Event bus interface for publishing and subscribing to domain events.
 */
export interface IEventBus {
  /**
   * Publish a single event to all registered handlers.
   * @param event - The domain event to publish
   */
  publish(event: IDomainEvent): Promise<void>;

  /**
   * Publish multiple events in batch.
   * @param events - Array of domain events to publish
   */
  publishBatch(events: IDomainEvent[]): Promise<void>;

  /**
   * Subscribe a handler to a specific event type.
   * @param eventType - The event type to listen for
   * @param handler - The handler to invoke when events of this type are published
   */
  subscribe<T extends IDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>
  ): void;

  /**
   * Unsubscribe a handler from an event type.
   * @param eventType - The event type to unsubscribe from
   * @param handler - The handler to remove
   */
  unsubscribe<T extends IDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>
  ): void;
}
