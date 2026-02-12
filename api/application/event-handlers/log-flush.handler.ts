import { BaseEventHandler } from '@api/infrastructure/events/base-event-handler'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'
import type { ILogger } from '@api/infrastructure/logging/logger.interface'
import type { RequestCompletedEvent } from '@api/domain/events/request-completed.event'
import type { DatabaseLogger } from '@api/infrastructure/logging/database.logger'

/**
 * Handles flushing queued logs to database after request completion.
 * This is a NON-CRITICAL handler - failures will not break the request.
 */
export class LogFlushHandler extends BaseEventHandler {
  constructor(
    private databaseLogger: DatabaseLogger,
    logger: ILogger
  ) {
    super(logger)
  }

  getEventTypes(): string[] {
    return ['RequestCompleted']
  }

  async handle(event: IDomainEvent): Promise<void> {
    if (event.eventType === 'RequestCompleted') {
      await this.handleRequestCompleted(event as RequestCompletedEvent)
    }
  }

  /**
   * Flush queued logs to database.
   * Uses safeExecute since this is non-critical - we don't want to break the app
   * if database logging fails.
   */
  private async handleRequestCompleted(event: RequestCompletedEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { requestId, queuedLogs } = event.payload

        if (queuedLogs.length === 0) {
          return
        }

        this.logger.debug('Flushing queued logs to database', {
          requestId,
          logCount: queuedLogs.length,
        })

        await this.databaseLogger.flushQueuedLogs(queuedLogs)

        this.logger.debug('Successfully flushed logs', {
          requestId,
          logCount: queuedLogs.length,
        })
      },
      event,
      'Failed to flush queued logs to database'
    )
  }
}
