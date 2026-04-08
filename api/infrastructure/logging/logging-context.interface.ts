/**
 * Logging Context Types
 * Defines types for AsyncLocalStorage-based logging context
 */

/**
 * Log context type - identifies where a log originated
 */
export type LogContextType = 'http_request' | 'cron_job' | 'event_handler' | 'background'

/**
 * Log queue entry - structure for logs before database insertion
 */
export interface LogQueueEntry {
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  component: string | null
  context_type: LogContextType
  metadata: Record<string, unknown> | null
  error_stack: string | null
  request_id: string | null
  user_id: number | null
  service: string
}

/**
 * Logging context stored in AsyncLocalStorage
 * Tracks request-scoped state and queued logs
 */
export interface LoggingContext {
  /**
   * Unique identifier for the request/operation
   */
  requestId: string

  /**
   * User ID (populated by auth middleware)
   */
  userId?: number

  /**
   * Type of context (determines queueing behavior)
   */
  contextType: LogContextType

  /**
   * In-memory queue of logs for this request
   * Flushed to database after response sent
   */
  queuedLogs: LogQueueEntry[]
}
