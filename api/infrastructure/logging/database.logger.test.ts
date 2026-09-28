import { describe, it, expect, vi } from "vitest"
import { DatabaseLogger } from "./database.logger"
import { withLoggingContext } from "./logging-context-store"
import type { LoggingContext } from "./logging-context.interface"
import type { ILogger } from "./logger.interface"

const silentLogger = (): ILogger => {
  const logger: ILogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => logger,
  }
  return logger
}

const makeLogger = () => {
  const repo = { create: vi.fn(async () => ({})), createMany: vi.fn(async () => ({})) }
  const logger = new DatabaseLogger(silentLogger(), repo as any, { service: "test" })
  return { logger, repo }
}

const requestContext = (userId?: number): LoggingContext => ({
  requestId: "req-1",
  userId,
  contextType: "http_request",
  queuedLogs: [],
})

/** Log inside a request context and return the queued rows. */
const logInRequest = async (callerUserId: number | undefined, fn: (logger: ILogger) => void) => {
  const { logger } = makeLogger()
  const ctx = requestContext(callerUserId)
  await withLoggingContext(ctx, async () => {
    fn(logger)
    // persistLog is async; let it run
    await new Promise((resolve) => setImmediate(resolve))
  })
  return ctx.queuedLogs
}

describe("DatabaseLogger user_id", () => {
  it("files a line under the caller when no subject is named", async () => {
    const [row] = await logInRequest(999728, (logger) => logger.info("Pausing subscription", { subscriptionId: 245 }))

    expect(row.user_id).toBe(999728)
    expect(row.metadata).toEqual({ subscriptionId: 245 })
  })

  it("files a line under the subject named in the meta and keeps the caller in metadata", async () => {
    const [row] = await logInRequest(999728, (logger) =>
      logger.info("Subscription paused successfully", { subscriptionId: 245, subjectUserId: 999749 })
    )

    expect(row.user_id).toBe(999749)
    expect(row.metadata).toEqual({ subscriptionId: 245, callerUserId: 999728 })
  })

  it("applies a child logger's subjectUserId to every line it writes", async () => {
    const rows = await logInRequest(999728, (logger) => {
      const log = logger.child({ subjectUserId: 999749 })
      log.info("one")
      log.warn("two")
      log.error("three", new Error("boom"))
    })

    expect(rows.map((r) => r.user_id)).toEqual([999749, 999749, 999749])
    expect(rows.every((r) => r.metadata?.callerUserId === 999728)).toBe(true)
  })

  it("records a null caller when a subject is named outside an authenticated request", async () => {
    const [row] = await logInRequest(undefined, (logger) => logger.info("cron line", { subjectUserId: 999749 }))

    expect(row.user_id).toBe(999749)
    expect(row.metadata).toEqual({ callerUserId: null })
  })

  it("ignores a subjectUserId that is not a positive integer", async () => {
    const [row] = await logInRequest(999728, (logger) => logger.info("bad subject", { subjectUserId: "999749" }))

    expect(row.user_id).toBe(999728)
  })

  it("writes the subject straight to the repository in a background context", async () => {
    const { logger, repo } = makeLogger()
    logger.info("background line", { subjectUserId: 999749 })
    await new Promise((resolve) => setImmediate(resolve))

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 999749, metadata: JSON.stringify({ callerUserId: null }) })
    )
  })
})
