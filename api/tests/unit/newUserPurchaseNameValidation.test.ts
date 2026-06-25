import { describe, it, expect } from "vitest"
import { FullNameSchema, NewUserPurchaseInputSchema } from "@api/use-cases/types/validation.schemas"

/**
 * Regression coverage for Zoho Desk #1053 — agents were able to sign up through
 * the public new-user purchase flow without providing a last name. The name
 * field must now contain at least a first and last name.
 */
describe("FullNameSchema", () => {
  it("accepts a first and last name", () => {
    expect(FullNameSchema.parse("Jane Doe")).toBe("Jane Doe")
  })

  it("trims surrounding and collapses-tolerates inner whitespace", () => {
    expect(FullNameSchema.parse("  Jane   Doe  ")).toBe("Jane   Doe")
  })

  it("rejects a single name with no last name", () => {
    expect(FullNameSchema.safeParse("Annette").success).toBe(false)
  })

  it("rejects an empty or whitespace-only name", () => {
    expect(FullNameSchema.safeParse("").success).toBe(false)
    expect(FullNameSchema.safeParse("   ").success).toBe(false)
  })

  it("rejects a missing (null/undefined) name", () => {
    expect(FullNameSchema.safeParse(null).success).toBe(false)
    expect(FullNameSchema.safeParse(undefined).success).toBe(false)
  })
})

describe("NewUserPurchaseInputSchema name validation", () => {
  const base = {
    productId: 1,
    email: "agent@example.com",
    phone: "+15555550123",
  }

  it("passes when a full name is provided", () => {
    const result = NewUserPurchaseInputSchema.safeParse({ ...base, name: "Jane Doe" })
    expect(result.success).toBe(true)
  })

  it("fails when the name has no last name", () => {
    const result = NewUserPurchaseInputSchema.safeParse({ ...base, name: "Jane" })
    expect(result.success).toBe(false)
  })

  it("fails when the name is omitted", () => {
    const result = NewUserPurchaseInputSchema.safeParse({ ...base })
    expect(result.success).toBe(false)
  })
})
