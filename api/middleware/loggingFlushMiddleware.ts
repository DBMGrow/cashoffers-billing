import type { MiddlewareHandler } from 'hono'
import { getLoggingContext } from '@api/infrastructure/logging/logging-context-store'
import { RequestCompletedEvent } from '@api/domain/events/request-completed.event'
import { getContainer } from '@api/container'

/**
 * Logging Flush Middleware
 *
 * Publishes RequestCompletedEvent after response is sent:
 * - Executes AFTER the response has been sent to client
 * - Extracts queued logs from AsyncLocalStorage context
 * - Publishes event to trigger log flushing to database
 * - Uses setImmediate to avoid blocking the response
 *
 * MUST be registered EARLY in middleware chain (before route handlers)
 * This ensures onFinish hook runs AFTER all other middleware
 */
export const loggingFlushMiddleware: MiddlewareHandler = async (c, next) => {
  // Continue with request
  await next()

  // After response sent: Flush logs asynchronously
  // Use setImmediate to avoid blocking the response
  setImmediate(async () => {
    try {
      const loggingContext = getLoggingContext()

      if (!loggingContext || loggingContext.queuedLogs.length === 0) {
        return
      }

      // Get event bus from container
      const container = getContainer()
      const eventBus = container.services.eventBus

      // Publish event to flush logs
      const event = RequestCompletedEvent.create({
        requestId: loggingContext.requestId,
        userId: loggingContext.userId,
        queuedLogs: loggingContext.queuedLogs,
      })

      await eventBus.publish(event)
    } catch (err) {
      // Don't let flushing errors break the app
      console.error('Failed to publish RequestCompletedEvent:', err)
    }
  })
}
