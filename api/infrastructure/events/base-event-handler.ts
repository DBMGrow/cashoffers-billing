import type { IEventHandler, IDomainEvent } from './event-bus.interface'
import type { ILogger } from '@api/infrastructure/logging/logger.interface'

/**
 * Abstract base class for event handlers.
 * Provides common logging and error handling functionality.
 */
export abstract class BaseEventHandler<T extends IDomainEvent = IDomainEvent>
  implements IEventHandler<T>
{
  protected logger: ILogger

  constructor(logger: ILogger) {
    this.logger = logger.child({
      component: this.constructor.name,
    })
  }

  /**
   * Handle the event. Subclasses must implement this method.
   */
  abstract handle(event: T): Promise<void>

  /**
   * Get the event types this handler is interested in.
   * Override this to specify which events to listen for.
   */
  abstract getEventTypes(): string[]

  /**
   * Helper method to safely execute handler logic with error handling.
   * Use this for non-critical operations that shouldn't fail the entire event.
   *
   * @param operation - The async operation to execute
   * @param event - The event being processed
   * @param errorMessage - Custom error message for logging
   */
  protected async safeExecute(
    operation: () => Promise<void>,
    event: IDomainEvent,
    errorMessage: string
  ): Promise<void> {
    try {
      await operation()
    } catch (error) {
      // Log but don't throw - this allows other handlers to continue
      this.logger.warn(errorMessage, {
        error: error instanceof Error ? error.message : String(error),
        eventType: event.eventType,
        eventId: event.eventId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
      })
    }
  }

  /**
   * Helper method to execute critical operations that must succeed.
   * If the operation fails, the error is thrown and the event processing fails.
   *
   * @param operation - The async operation to execute
   * @param event - The event being processed
   * @param errorMessage - Custom error message for logging
   */
  protected async criticalExecute(
    operation: () => Promise<void>,
    event: IDomainEvent,
    errorMessage: string
  ): Promise<void> {
    try {
      await operation()
    } catch (error) {
      this.logger.error(errorMessage, error instanceof Error ? error : new Error(String(error)), {
        eventType: event.eventType,
        eventId: event.eventId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
      })
      throw error // Re-throw to fail the event processing
    }
  }
}
