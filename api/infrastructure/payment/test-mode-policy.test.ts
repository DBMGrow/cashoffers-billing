import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"
import {
  TEST_MODE_CAPABILITY,
  TEST_MODE_EMAIL_DOMAIN,
  TEST_MODE_NOT_ALLOWED,
  isTestModeAllowed,
  isTestModeEmail,
  resolvePaymentContext,
  type TestModeRequest,
} from "./test-mode-policy"

/** Run resolvePaymentContext inside a real Hono request so query and header parsing is real. */
async function resolve(input: TestModeRequest, init: { query?: string; headers?: Record<string, string> } = {}) {
  let decision: ReturnType<typeof resolvePaymentContext> | undefined
  const app = new Hono()
  app.get("/x", (c) => {
    decision = resolvePaymentContext(c, input)
    return c.text("ok")
  })
  await app.request(`/x${init.query ?? ""}`, { headers: init.headers })
  return decision!
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

describe("isTestModeEmail", () => {
  it("accepts the test domain, case-insensitively", () => {
    expect(TEST_MODE_EMAIL_DOMAIN).toBe("@test.cashoffers.com")
    expect(isTestModeEmail("demo@test.cashoffers.com")).toBe(true)
    expect(isTestModeEmail("Demo@TEST.CashOffers.com")).toBe(true)
  })

  it("rejects look-alike and ordinary addresses", () => {
    expect(isTestModeEmail("demo@cashoffers.com")).toBe(false)
    expect(isTestModeEmail("demo@test.cashoffers.com.evil.com")).toBe(false)
    expect(isTestModeEmail("demo@nottest.cashoffers.com")).toBe(false)
    expect(isTestModeEmail(null)).toBe(false)
  })

  it("treats the team's own @dbmgrow.com addresses as test accounts", () => {
    expect(isTestModeEmail("david@dbmgrow.com")).toBe(true)
    expect(isTestModeEmail(" David@DBMGrow.com ")).toBe(true)
    expect(isTestModeEmail("david@sub.dbmgrow.com")).toBe(false)
    expect(isTestModeEmail("david@notdbmgrow.com")).toBe(false)
    expect(isTestModeEmail("david@dbmgrow.com.evil.com")).toBe(false)
    expect(isTestModeEmail(undefined)).toBe(false)
  })
})

describe("isTestModeAllowed", () => {
  it("allows the test domain without a capability", () => {
    expect(isTestModeAllowed({ buyerEmail: "a@test.cashoffers.com", capabilities: [] })).toBe(true)
  })

  it("allows the payments_test_mode capability for any email", () => {
    expect(isTestModeAllowed({ buyerEmail: "a@example.com", capabilities: [TEST_MODE_CAPABILITY] })).toBe(true)
  })

  it("refuses everyone else", () => {
    expect(isTestModeAllowed({ buyerEmail: "a@example.com", capabilities: ["payments_create"] })).toBe(false)
    expect(isTestModeAllowed({ buyerEmail: "a@example.com" })).toBe(false)
  })
})

describe("resolvePaymentContext", () => {
  it("returns a production context when nothing asks for test mode", async () => {
    const decision = await resolve({ buyerEmail: "a@example.com" })
    expect(decision.allowed).toBe(true)
    if (decision.allowed) expect(decision.context.testMode).toBe(false)
    expect(console.warn).not.toHaveBeenCalled()
  })

  it.each([
    ["mock_purchase", { mockPurchase: true }, {}],
    ["query_parameter", {}, { query: "?test_mode=true" }],
    ["header", {}, { headers: { "X-Test-Mode": "true" } }],
  ] as const)(
    "refuses %s for an ordinary email with TEST_MODE_NOT_ALLOWED and logs it",
    async (source, extra, init) => {
      const decision = await resolve({ buyerEmail: "a@example.com", capabilities: [], ...extra }, init)
      expect(decision.allowed).toBe(false)
      if (!decision.allowed) {
        expect(decision.status).toBe(403)
        expect(decision.body.code).toBe(TEST_MODE_NOT_ALLOWED)
        expect(decision.requestedBy).toEqual([source])
      }
      expect(console.warn).toHaveBeenCalledWith(
        "[TEST MODE REFUSED]",
        expect.objectContaining({ requestedBy: [source] })
      )
    }
  )

  it("allows mock_purchase for the test domain and writes the audit line", async () => {
    const decision = await resolve({ buyerEmail: "a@test.cashoffers.com", mockPurchase: true })
    expect(decision.allowed).toBe(true)
    if (decision.allowed) {
      expect(decision.context.testMode).toBe(true)
      expect(decision.context.metadata?.detectedFrom).toBe("mock_purchase")
    }
    expect(console.log).toHaveBeenCalledWith(
      "[TEST MODE ACTIVATED]",
      expect.objectContaining({ detectedFrom: "mock_purchase" })
    )
  })

  it("puts a test-domain buyer in test mode even without an explicit flag", async () => {
    const decision = await resolve({ buyerEmail: "a@test.cashoffers.com" })
    expect(decision.allowed && decision.context.testMode).toBe(true)
  })

  it("allows the header for a caller with the capability", async () => {
    const decision = await resolve(
      { buyerEmail: "a@example.com", capabilities: [TEST_MODE_CAPABILITY] },
      { headers: { "X-Test-Mode": "true" } }
    )
    expect(decision.allowed && decision.context.testMode).toBe(true)
  })
})
