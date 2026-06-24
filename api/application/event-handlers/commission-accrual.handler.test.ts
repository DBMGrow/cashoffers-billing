import { describe, it, expect, vi, beforeEach } from "vitest"
import { CommissionAccrualHandler } from "./commission-accrual.handler"
import type { ICommissionApiClient } from "@api/infrastructure/external-api/commission-api.interface"
import type { IDomainEvent } from "@api/infrastructure/events/event-bus.interface"

// Minimal logger stub — BaseEventHandler calls logger.child() in its constructor.
function makeLogger() {
  const calls: { level: string; msg: string; meta?: unknown }[] = []
  const log = {
    calls,
    child: () => log,
    info: (msg: string, meta?: unknown) => calls.push({ level: "info", msg, meta }),
    warn: (msg: string, meta?: unknown) => calls.push({ level: "warn", msg, meta }),
    error: (msg: string, _e?: unknown, meta?: unknown) => calls.push({ level: "error", msg, meta }),
    debug: (msg: string, meta?: unknown) => calls.push({ level: "debug", msg, meta }),
  }
  return log as any
}

function makeEvent(eventType: string, payload: Record<string, unknown>): IDomainEvent {
  return {
    eventId: "evt-1",
    eventType,
    occurredAt: new Date(),
    aggregateId: 1,
    aggregateType: "Test",
    payload,
  }
}

describe("CommissionAccrualHandler", () => {
  let client: ICommissionApiClient & { accrue: ReturnType<typeof vi.fn>; reverse: ReturnType<typeof vi.fn> }
  let logger: ReturnType<typeof makeLogger>
  let handler: CommissionAccrualHandler

  beforeEach(() => {
    client = { accrue: vi.fn(async () => {}), reverse: vi.fn(async () => {}) }
    logger = makeLogger()
    handler = new CommissionAccrualHandler(client, logger)
  })

  it("subscribes to the three money-moving events", () => {
    expect(handler.getEventTypes()).toEqual(["PaymentProcessed", "SubscriptionRenewed", "PaymentRefunded"])
  })

  it("PaymentProcessed → accrue with the payment transaction_id", async () => {
    await handler.handle(makeEvent("PaymentProcessed", { transactionId: 3599 }))
    expect(client.accrue).toHaveBeenCalledWith({ transaction_id: 3599 })
    expect(client.reverse).not.toHaveBeenCalled()
  })

  it("SubscriptionRenewed → accrue with the renewal transaction_id", async () => {
    await handler.handle(makeEvent("SubscriptionRenewed", { transactionId: 3600 }))
    expect(client.accrue).toHaveBeenCalledWith({ transaction_id: 3600 })
  })

  it("PaymentRefunded → reverse using the ORIGINAL transaction_id", async () => {
    await handler.handle(makeEvent("PaymentRefunded", { transactionId: 9001, originalTransactionId: 3599 }))
    expect(client.reverse).toHaveBeenCalledWith({ transaction_id: 3599 })
    expect(client.accrue).not.toHaveBeenCalled()
  })

  it("missing transaction_id → skipped with a warning, no client call", async () => {
    await handler.handle(makeEvent("PaymentProcessed", {}))
    expect(client.accrue).not.toHaveBeenCalled()
    expect(logger.calls.some((c: any) => c.level === "warn" && c.msg.includes("skipped"))).toBe(true)
  })

  it("client failure is swallowed (sweep reconciles) — handler does NOT throw", async () => {
    client.accrue = vi.fn(async () => {
      throw new Error("api-v2 unreachable (404)")
    })
    handler = new CommissionAccrualHandler(client, logger)
    await expect(handler.handle(makeEvent("PaymentProcessed", { transactionId: 3599 }))).resolves.toBeUndefined()
    expect(logger.calls.some((c: any) => c.level === "warn" || c.level === "error")).toBe(true)
  })
})
