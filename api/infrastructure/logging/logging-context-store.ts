import { AsyncLocalStorage } from 'async_hooks'
import { LoggingContext } from './logging-context.interface'

/**
 * AsyncLocalStorage instance for logging context
 * Automatically tracks context across async operations
 */
export const loggingContextStore = new AsyncLocalStorage<LoggingContext>()

/**
 * Get the current logging context (or null if not in a context)
 */
export const getLoggingContext = (): LoggingContext | null => {
  return loggingContextStore.getStore() || null
}

/**
 * Set the logging context for the current async flow
 * Note: Prefer using withLoggingContext for automatic cleanup
 */
export const setLoggingContext = (context: LoggingContext): void => {
  // AsyncLocalStorage doesn't have a direct "set" - use run() or enterWith()
  // This function is mainly for documentation; in practice use withLoggingContext
  throw new Error(
    'Use withLoggingContext() or loggingContextStore.run() to set context'
  )
}

/**
 * Execute a function with a specific logging context
 * Automatically cleans up after execution
 */
export const withLoggingContext = <T>(
  context: LoggingContext,
  fn: () => T | Promise<T>
): T | Promise<T> => {
  return loggingContextStore.run(context, fn)
}
