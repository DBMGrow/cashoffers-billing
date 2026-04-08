import { ILogger } from "./logger.interface"
import type { BillingLogRepository } from "@api/lib/repositories"
import { getLoggingContext } from "./logging-context-store"
import { LogQueueEntry, LogContextType } from "./logging-context.interface"

/**
 * Database Logger - Decorator Pattern
 *
 * Wraps StructuredLogger and adds database persistence:
 * - In HTTP request context: Queue logs in memory
 * - In cron/background context: Write immediately to database
 * - Always logs to console (via wrapped logger)
 *
 * Uses AsyncLocalStorage to automatically detect context
 */
export class DatabaseLogger implements ILogger {
  private baseContext: Record<string, unknown>
  private serviceName: string

  constructor(
    private wrappedLogger: ILogger,
    private billingLogRepository: BillingLogRepository,
    baseContext: Record<string, unknown> = {}
  ) {
    this.baseContext = baseContext
    this.serviceName = (baseContext.service as string) || "cashoffers-billing"
  }

  /**
   * Internal method to handle log persistence
   */
  private async persistLog(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    meta?: Record<string, unknown>,
    errorStack?: string
  ): Promise<void> {
    try {
      const loggingContext = getLoggingContext()
      const component = (meta?.component as string) || (this.baseContext.component as string) || null

      // Determine context type
      let contextType: LogContextType = "background"
      if (loggingContext) {
        contextType = loggingContext.contextType
      } else if (meta?.contextType) {
        contextType = meta.contextType as LogContextType
      }

      // Build log entry
      const logEntry: LogQueueEntry = {
        level,
        message,
        component,
        context_type: contextType,
        metadata: meta ? this.sanitizeMetadata(meta) : null,
        error_stack: errorStack || null,
        request_id: loggingContext?.requestId || null,
        user_id: loggingContext?.userId || null,
        service: this.serviceName,
      }

      // Queue or write immediately based on context
      if (loggingContext && loggingContext.contextType === "http_request") {
        // HTTP request context - queue for later flush
        loggingContext.queuedLogs.push(logEntry)
      } else {
        // Cron/background context - write immediately
        await this.billingLogRepository.create({
          ...logEntry,
          metadata: logEntry.metadata ? JSON.stringify(logEntry.metadata) : null,
        })
      }
    } catch (err) {
      // Database logging failures should not break the application
      // Log to console only
      console.error("Failed to persist log to database:", err)
    }
  }

  /**
   * Sanitize metadata for JSON storage
   * Remove circular references and non-serializable values
   */
  private sanitizeMetadata(meta: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(meta)) {
      // Skip internal context fields
      if (key === "contextType" || key === "component") {
        continue
      }

      try {
        // Test if value is serializable
        JSON.stringify(value)
        sanitized[key] = value
      } catch {
        // Non-serializable value - convert to string
        sanitized[key] = String(value)
      }
    }

    return sanitized
  }

  /**
   * Flush queued logs to database
   * Called by log-flush.handler after request completion
   */
  async flushQueuedLogs(queuedLogs: LogQueueEntry[]): Promise<void> {
    if (queuedLogs.length === 0) {
      return
    }

    try {
      await this.billingLogRepository.createMany(
        queuedLogs.map((entry) => ({
          ...entry,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        }))
      )
    } catch (err) {
      console.error("Failed to flush queued logs to database:", err)
    }
  }

  // ILogger interface implementation - delegates to wrapped logger + persists

  info(message: string, meta?: Record<string, unknown>): void {
    this.wrappedLogger.info(message, meta)
    this.persistLog("info", message, meta).catch(() => {
      // Errors already logged in persistLog
    })
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.wrappedLogger.warn(message, meta)
    this.persistLog("warn", message, meta).catch(() => {
      // Errors already logged in persistLog
    })
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    this.wrappedLogger.error(message, error, meta)

    const errorStack = error instanceof Error ? error.stack : undefined
    this.persistLog("error", message, meta, errorStack).catch(() => {
      // Errors already logged in persistLog
    })
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.wrappedLogger.debug(message, meta)
    this.persistLog("debug", message, meta).catch(() => {
      // Errors already logged in persistLog
    })
  }

  child(context: Record<string, unknown>): ILogger {
    // Create child of wrapped logger and wrap it in a new DatabaseLogger
    const childWrappedLogger = this.wrappedLogger.child(context)
    return new DatabaseLogger(childWrappedLogger, this.billingLogRepository, { ...this.baseContext, ...context })
  }
}

/**
 * Create a database logger that wraps an existing logger
 */
export const createDatabaseLogger = (
  wrappedLogger: ILogger,
  billingLogRepository: BillingLogRepository,
  baseContext?: Record<string, unknown>
): ILogger => {
  return new DatabaseLogger(wrappedLogger, billingLogRepository, baseContext)
}
