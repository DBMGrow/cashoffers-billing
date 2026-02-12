import type { MiddlewareHandler } from 'hono'
import { loggingContextStore } from '@api/infrastructure/logging/logging-context-store'
import type { LoggingContext } from '@api/infrastructure/logging/logging-context.interface'

/**
 * Logging Context Middleware
 *
 * Sets up AsyncLocalStorage context for request-scoped logging:
 * - Creates LoggingContext with requestId from digestMiddleware
 * - Initializes empty log queue for this request
 * - Stores context in AsyncLocalStorage (available to all downstream code)
 *
 * MUST be registered AFTER digestMiddleware (which creates requestId)
 * MUST be registered EARLY in middleware chain (before route handlers)
 */
export const loggingContextMiddleware: MiddlewareHandler = async (c, next) => {
  // Get requestId from context (set by digestMiddleware)
  const requestId = c.get('requestId')

  if (!requestId) {
    console.error('loggingContextMiddleware: No requestId found in context')
    // Continue without logging context rather than breaking the request
    await next()
    return
  }

  // Create logging context for this request
  const loggingContext: LoggingContext = {
    requestId,
    contextType: 'http_request',
    queuedLogs: [],
    // userId will be set later by authMiddleware if user is authenticated
  }

  // Run the rest of the request within this logging context
  await loggingContextStore.run(loggingContext, async () => {
    await next()
  })
}
