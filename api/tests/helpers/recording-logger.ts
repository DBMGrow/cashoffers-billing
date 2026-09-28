import type { ILogger } from "@api/infrastructure/logging/logger.interface"

export interface RecordedLine {
  level: "info" | "warn" | "error" | "debug"
  message: string
  /** The subject the DatabaseLogger would file the line under (meta first, then the child's context) */
  subjectUserId: unknown
}

/**
 * A logger that records each line with the subjectUserId it would carry into BillingLogs, so a use
 * case test can check which user its log lines are filed under.
 */
export function makeRecordingLogger(): { logger: ILogger; lines: RecordedLine[] } {
  const lines: RecordedLine[] = []
  const make = (context: Record<string, unknown>): ILogger => {
    const record = (level: RecordedLine["level"], message: string, meta?: Record<string, unknown>) =>
      lines.push({ level, message, subjectUserId: meta?.subjectUserId ?? context.subjectUserId })
    return {
      info: (message, meta) => record("info", message, meta),
      warn: (message, meta) => record("warn", message, meta),
      error: (message, _error, meta) => record("error", message, meta),
      debug: (message, meta) => record("debug", message, meta),
      child: (childContext) => make({ ...context, ...childContext }),
    }
  }
  return { logger: make({}), lines }
}
