import type { IEventBus, IDomainEvent, IEventHandler } from './event-bus.interface'
import type { ILogger } from '@/infrastructure/logging/logger.interface'

/**
 * Simple in-memory event bus implementation.
 * Executes handlers synchronously in the order they were registered.
 *
 * Note: This is a simple implementation suitable for development and testing.
 * For production with high reliability requirements, use OutboxEventBus instead.
 */
export class InMemoryEventBus implements IEventBus {
  private handlers: Map<string, IEventHandler[]> = new Map()
  private logger: ILogger

  constructor(logger: ILogger) {
    this.logger = logger.child({ component: 'InMemoryEventBus' })
  }

  /**
   * Publish a single event to all registered handlers
   */
  async publish(event: IDomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) || []

    if (handlers.length === 0) {
      this.logger.debug('No handlers registered for event', {
        eventType: event.eventType,
        eventId: event.eventId,
      })
      return
    }

    this.logger.debug('Publishing event', {
      eventType: event.eventType,
      eventId: event.eventId,
      handlerCount: handlers.length,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
    })

    // Execute all handlers
    const results = await Promise.allSettled(
      handlers.map(async (handler) => {
        try {
          await handler.handle(event)
          this.logger.debug('Handler executed successfully', {
            eventType: event.eventType,
            eventId: event.eventId,
            handler: handler.constructor.name,
          })
        } catch (error) {
          this.logger.error(
            'Handler failed to process event',
            error instanceof Error ? error : new Error(String(error)),
            {
              eventType: event.eventType,
              eventId: event.eventId,
              handler: handler.constructor.name,
              aggregateType: event.aggregateType,
              aggregateId: event.aggregateId,
            }
          )
          // Re-throw to be caught by Promise.allSettled
          throw error
        }
      })
    )

    // Check if any critical handlers failed
    const failures = results.filter((r) => r.status === 'rejected')
    if (failures.length > 0) {
      // For now, we log failures but don't throw
      // In Phase 3 (Outbox pattern), we'll have better retry logic
      this.logger.warn('Some event handlers failed', {
        eventType: event.eventType,
        eventId: event.eventId,
        failureCount: failures.length,
        totalHandlers: handlers.length,
      })
    }
  }

  /**
   * Publish multiple events in batch
   */
  async publishBatch(events: IDomainEvent[]): Promise<void> {
    this.logger.debug('Publishing event batch', {
      eventCount: events.length,
    })

    for (const event of events) {
      await this.publish(event)
    }
  }

  /**
   * Subscribe a handler to a specific event type
   */
  subscribe<T extends IDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>
  ): void {
    const handlers = this.handlers.get(eventType) || []
    handlers.push(handler as IEventHandler)
    this.handlers.set(eventType, handlers)

    this.logger.info('Handler subscribed to event', {
      eventType,
      handler: handler.constructor.name,
      totalHandlers: handlers.length,
    })
  }

  /**
   * Unsubscribe a handler from an event type
   */
  unsubscribe<T extends IDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>
  ): void {
    const handlers = this.handlers.get(eventType) || []
    const filtered = handlers.filter((h) => h !== handler)
    this.handlers.set(eventType, filtered)

    this.logger.info('Handler unsubscribed from event', {
      eventType,
      handler: handler.constructor.name,
      remainingHandlers: filtered.length,
    })
  }

  /**
   * Get the count of handlers for a specific event type (useful for testing)
   */
  getHandlerCount(eventType: string): number {
    return (this.handlers.get(eventType) || []).length
  }

  /**
   * Clear all handlers (useful for testing)
   */
  clearAllHandlers(): void {
    this.handlers.clear()
    this.logger.info('All event handlers cleared')
  }
}
