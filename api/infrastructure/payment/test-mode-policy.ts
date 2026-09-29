import type { Context as HonoContext } from "hono"
import type { PaymentContext } from "@api/config/config.interface"
import { TEST_MODE_EMAIL_DOMAIN, isTestAccountEmail } from "@api/domain/services/test-account"

/**
 * Test mode policy: the one rule that decides whether a request may run its payment in the
 * Square sandbox.
 *
 * `testMode: true` sends the charge to the Square sandbox (see dual-environment-provider.ts), and
 * production has sandbox credentials configured, so a purchase in test mode yields a real paid
 * account without real money. Every path that can put a charge in test mode must go through
 * `resolvePaymentContext` so the rule lives in one place.
 */

/**
 * Buyers whose email ends with TEST_MODE_EMAIL_DOMAIN may purchase in test mode without any
 * capability. The domain lives in api/domain/services/test-account.ts so the account site can
 * share it (it skips the card form for these accounts); this file stays the only authority.
 */
export { TEST_MODE_EMAIL_DOMAIN }

/** Capability that lets an authenticated user run any purchase in test mode. */
export const TEST_MODE_CAPABILITY = "payments_test_mode"

/** Stable error code returned when test mode is requested but not allowed. */
export const TEST_MODE_NOT_ALLOWED = "TEST_MODE_NOT_ALLOWED"

/**
 * Deliberately generic: naming the allowed domain or capability here would tell anyone who
 * triggers the refusal exactly how to get a sandbox-paid account.
 */
export const TEST_MODE_NOT_ALLOWED_MESSAGE = "Test purchases aren't available for this account. Nothing was charged."

export type TestModeSource = "query_parameter" | "header" | "mock_purchase" | "user_email"

export interface TestModeRequest {
  /** Email of the account that receives the purchase (the buyer). */
  buyerEmail: string | null | undefined
  /** Capabilities of the authenticated caller; empty for unauthenticated routes. */
  capabilities?: readonly string[] | null
  /** User id for the audit trail, when known. */
  userId?: number
  /** True when the request body asked for a mock purchase. */
  mockPurchase?: boolean | null
}

export interface TestModeRefusalBody {
  success: "error"
  error: string
  code: typeof TEST_MODE_NOT_ALLOWED
}

export type TestModeDecision =
  | { allowed: true; context: PaymentContext }
  | { allowed: false; status: 403; body: TestModeRefusalBody; requestedBy: TestModeSource[] }

/** True when the email belongs to the test-account domain (case-insensitive). */
export function isTestModeEmail(email: string | null | undefined): boolean {
  return isTestAccountEmail(email)
}

/**
 * The rule: test mode is allowed only when the buyer's email is on the test domain, or the
 * authenticated caller has the payments_test_mode capability.
 */
export function isTestModeAllowed(input: Pick<TestModeRequest, "buyerEmail" | "capabilities">): boolean {
  return isTestModeEmail(input.buyerEmail) || (input.capabilities ?? []).includes(TEST_MODE_CAPABILITY)
}

/** Every signal in the request that asks for test mode, in priority order. */
export function detectTestModeSources(c: HonoContext, input: TestModeRequest): TestModeSource[] {
  const sources: TestModeSource[] = []
  if (c.req.query("test_mode") === "true") sources.push("query_parameter")
  if (c.req.header("X-Test-Mode") === "true") sources.push("header")
  if (input.mockPurchase === true) sources.push("mock_purchase")
  if (isTestModeEmail(input.buyerEmail)) sources.push("user_email")
  return sources
}

/**
 * Build the payment context for a request, or refuse it.
 *
 * When any signal asks for test mode and the rule does not allow it, the caller must return the
 * 403 before doing any card or charge work. There is deliberately no silent fallback to a
 * production charge: a mock purchase skipped the card step and sent a sandbox nonce, so a
 * fallback would only fail later and confusingly.
 */
export function resolvePaymentContext(c: HonoContext, input: TestModeRequest): TestModeDecision {
  const requestedBy = detectTestModeSources(c, input)
  const timestamp = new Date().toISOString()

  if (requestedBy.length === 0) {
    return {
      allowed: true,
      context: { testMode: false, source: "API", userId: input.userId, metadata: { detectedFrom: "none", timestamp } },
    }
  }

  if (!isTestModeAllowed(input)) {
    console.warn("[TEST MODE REFUSED]", {
      code: TEST_MODE_NOT_ALLOWED,
      userId: input.userId,
      email: input.buyerEmail,
      requestedBy,
      path: c.req.path,
      timestamp,
    })
    return {
      allowed: false,
      status: 403,
      body: { success: "error", error: TEST_MODE_NOT_ALLOWED_MESSAGE, code: TEST_MODE_NOT_ALLOWED },
      requestedBy,
    }
  }

  const context: PaymentContext = {
    testMode: true,
    source: "API",
    userId: input.userId,
    metadata: { detectedFrom: requestedBy[0], requestedBy, timestamp },
  }

  // Audit trail for every sandbox purchase that is let through
  console.log("[TEST MODE ACTIVATED]", {
    userId: input.userId,
    email: input.buyerEmail,
    detectedFrom: requestedBy[0],
    requestedBy,
    timestamp,
  })

  return { allowed: true, context }
}
