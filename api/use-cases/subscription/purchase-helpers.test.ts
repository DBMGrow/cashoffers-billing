import { describe, it, expect } from "vitest"
import { isUserFacingError } from "./purchase-helpers"

describe("isUserFacingError", () => {
  it("treats TRANSACTION_LIMIT as a user-facing card decline (not a system error)", () => {
    // Square classifies TRANSACTION_LIMIT as a non-critical card decline, so the
    // purchase flow must surface it as a declined payment (HTTP 400, no developer
    // system-error alert), matching the renewal flow and the error translator.
    expect(isUserFacingError("TRANSACTION_LIMIT")).toBe(true)
  })

  it("keeps other card-decline codes user-facing", () => {
    expect(isUserFacingError("CARD_DECLINED")).toBe(true)
    expect(isUserFacingError("INSUFFICIENT_FUNDS")).toBe(true)
    expect(isUserFacingError("EXPIRED_CARD")).toBe(true)
  })

  it("does not treat critical/unknown codes as user-facing", () => {
    expect(isUserFacingError("UNAUTHORIZED")).toBe(false)
    expect(isUserFacingError("PURCHASE_ERROR")).toBe(false)
    expect(isUserFacingError(undefined)).toBe(false)
  })
})
