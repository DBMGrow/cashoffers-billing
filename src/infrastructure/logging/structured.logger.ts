import { ILogger, LogLevel, LogEntry } from './logger.interface'

/**
 * Structured Logger Implementation
 * Outputs JSON-formatted logs for easy parsing and analysis
 */
export class StructuredLogger implements ILogger {
  private context: Record<string, unknown>

  constructor(
    baseContext: Record<string, unknown> = {},
    private minLevel: LogLevel = 'info'
  ) {
    this.context = { ...baseContext }
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    if (levels.indexOf(level) < levels.indexOf(this.minLevel)) {
      return
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...meta,
    }

    const output = JSON.stringify(entry)

    switch (level) {
      case 'error':
        console.error(output)
        break
      case 'warn':
        console.warn(output)
        break
      case 'debug':
        console.debug(output)
        break
      default:
        console.log(output)
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta)
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta)
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const errorMeta: Record<string, unknown> = { ...meta }

    if (error instanceof Error) {
      errorMeta.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } else if (error) {
      errorMeta.error = error
    }

    this.log('error', message, errorMeta)
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta)
  }

  child(context: Record<string, unknown>): ILogger {
    return new StructuredLogger({ ...this.context, ...context }, this.minLevel)
  }
}

/**
 * Create a structured logger
 */
export const createLogger = (
  context?: Record<string, unknown>,
  minLevel?: LogLevel
): ILogger => {
  return new StructuredLogger(context, minLevel)
}
