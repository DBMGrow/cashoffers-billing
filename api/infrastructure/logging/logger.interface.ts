/**
 * Logger interface
 * Abstracts logging implementation for testability and flexibility
 */
export interface ILogger {
  /**
   * Log informational message
   */
  info(message: string, meta?: Record<string, unknown>): void

  /**
   * Log warning message
   */
  warn(message: string, meta?: Record<string, unknown>): void

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void

  /**
   * Log debug message
   */
  debug(message: string, meta?: Record<string, unknown>): void

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): ILogger
}

/**
 * Log level type
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  requestId?: string
  userId?: number
  duration?: number
  [key: string]: unknown
}
