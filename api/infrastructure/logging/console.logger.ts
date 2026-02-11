import { ILogger } from './logger.interface'

/**
 * Console Logger Implementation
 * Simple console-based logger for development
 */
export class ConsoleLogger implements ILogger {
  constructor(private context: Record<string, unknown> = {}) {}

  private formatMessage(message: string, meta?: Record<string, unknown>): string {
    const contextStr = Object.keys(this.context).length
      ? ` [${JSON.stringify(this.context)}]`
      : ''
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
    return `${message}${contextStr}${metaStr}`
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.log(`[INFO] ${this.formatMessage(message, meta)}`)
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[WARN] ${this.formatMessage(message, meta)}`)
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const errorInfo = error instanceof Error ? `\n${error.stack}` : ''
    console.error(`[ERROR] ${this.formatMessage(message, meta)}${errorInfo}`)
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    console.debug(`[DEBUG] ${this.formatMessage(message, meta)}`)
  }

  child(context: Record<string, unknown>): ILogger {
    return new ConsoleLogger({ ...this.context, ...context })
  }
}

/**
 * Create a console logger
 */
export const createConsoleLogger = (context?: Record<string, unknown>): ILogger => {
  return new ConsoleLogger(context)
}
