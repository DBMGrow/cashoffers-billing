import type { IEventHandler, IDomainEvent } from "@api/infrastructure/events/event-bus.interface"
import type { ICriticalAlertService } from "@api/domain/services/critical-alert.service"
import type { ILogger } from "@api/infrastructure/logging/logger.interface"

/**
 * AdminAlertHandler
 *
 * Wraps a list of "watched" event handlers and sends an admin alert
 * whenever one of them throws during event processing.
 *
 * This is a decorator/observer — it does NOT swallow the error.
 * The original handler decides whether to throw or catch.
 * This handler subscribes separately so it can detect failures
 * reported by the inner handler without coupling to it.
 */
export class AdminAlertHandler implements IEventHandler {
  constructor(
    private readonly innerHandler: IEventHandler,
    private readonly alertService: ICriticalAlertService,
    private readonly handlerName: string,
    private readonly logger: ILogger
  ) {}

  async handle(event: IDomainEvent): Promise<void> {
    try {
      await this.innerHandler.handle(event)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      this.logger.error(`${this.handlerName} failed, sending admin alert`, {
        eventType: event.eventType,
        eventId: event.eventId,
        error: err.message,
      })

      // Fire-and-forget: don't let alert failure block event processing
      this.alertService
        .alertCriticalError(`${this.handlerName} Provisioning Failure`, err, {
          eventType: event.eventType,
          eventId: event.eventId,
          aggregateId: event.aggregateId,
          payload: event.payload,
        })
        .catch((alertErr) => {
          this.logger.error('Failed to send admin alert', {
            error: alertErr instanceof Error ? alertErr.message : String(alertErr),
          })
        })

      // Re-throw so the original error propagation behavior is preserved
      throw error
    }
  }
}
