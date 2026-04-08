import { ILogger } from './logger.interface'

const R = '\x1b[0m'

const LEVEL_COLOR: Record<string, string> = {
  info: '\x1b[36m', // cyan
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
  debug: '\x1b[35m', // magenta
}

const LEVEL_LABEL: Record<string, string> = {
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
  debug: 'DEBUG',
}

function timestamp(): string {
  const now = new Date()
  const h = now.getHours().toString().padStart(2, '0')
  const m = now.getMinutes().toString().padStart(2, '0')
  const s = now.getSeconds().toString().padStart(2, '0')
  const ms = now.getMilliseconds().toString().padStart(3, '0')
  return `\x1b[90m${h}:${m}:${s}.${ms}${R}`
}

// Keys that are app-wide constants — skip them in the dev console (pure noise)
const SKIP_CONTEXT_KEYS = new Set(['service'])

function formatMeta(meta: Record<string, unknown>): string {
  return Object.entries(meta)
    .map(([k, v]) => {
      const val = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)
      return `\x1b[90m${k}=\x1b[37m${val}${R}`
    })
    .join('  ')
}

function formatContext(ctx: Record<string, unknown>): string {
  const entries = Object.entries(ctx).filter(([k]) => !SKIP_CONTEXT_KEYS.has(k))
  if (!entries.length) return ''
  // Single key: show just the value e.g. [InMemoryEventBus]
  const inner =
    entries.length === 1
      ? String(entries[0][1])
      : entries.map(([k, v]) => `${k}=${v}`).join(' ')
  return `\x1b[2m[${inner}]${R} `
}

function formatError(error: Error | unknown): string {
  if (!(error instanceof Error)) return ''

  const lines = (error.stack ?? error.message).split('\n')
  const [first, ...rest] = lines
  const stack = rest
    .map((l) => `\x1b[2m        ${l.trim()}${R}`)
    .join('\n')
  return `\n    \x1b[31m${first}${R}${stack ? '\n' + stack : ''}`
}

function buildLine(
  level: string,
  context: Record<string, unknown>,
  message: string,
  meta?: Record<string, unknown>
): string {
  const color = LEVEL_COLOR[level] ?? ''
  const badge = `${color}${LEVEL_LABEL[level] ?? level}${R}`
  const ctx = formatContext(context)
  const metaStr = meta && Object.keys(meta).length ? `  \x1b[90m·${R}  ${formatMeta(meta)}` : ''
  return `${badge}  ${timestamp()}  ${ctx}\x1b[1m${message}${R}${metaStr}`
}

/**
 * Console Logger Implementation
 * Human-readable colored output for development
 */
export class ConsoleLogger implements ILogger {
  constructor(private context: Record<string, unknown> = {}) {}

  info(message: string, meta?: Record<string, unknown>): void {
    console.log(buildLine('info', this.context, message, meta))
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(buildLine('warn', this.context, message, meta))
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    console.error(buildLine('error', this.context, message, meta) + formatError(error))
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    console.debug(buildLine('debug', this.context, message, meta))
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
