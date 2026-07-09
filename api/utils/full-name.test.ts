import { describe, it, expect } from "vitest"
import { isFullName } from "./full-name"
import { NewUserPurchaseInputSchema } from "@api/use-cases/types/validation.schemas"

describe("isFullName", () => {
  it("accepts a first and last name", () => {
    expect(isFullName("John Doe")).toBe(true)
    expect(isFullName("Mary Jane Watson")).toBe(true)
    expect(isFullName("  John   Doe  ")).toBe(true)
  })

  it("rejects a single name, empty, or whitespace-only", () => {
    expect(isFullName("John")).toBe(false)
    expect(isFullName("John ")).toBe(false)
    expect(isFullName("")).toBe(false)
    expect(isFullName("   ")).toBe(false)
    expect(isFullName(null)).toBe(false)
    expect(isFullName(undefined)).toBe(false)
  })
})

describe("NewUserPurchaseInputSchema name validation", () => {
  const base = { productId: 1, email: "agent@example.com", phone: "+15551234567" }

  it("rejects a signup whose name has no last name (ticket #1053)", () => {
    const result = NewUserPurchaseInputSchema.safeParse({ ...base, name: "John" })
    expect(result.success).toBe(false)
  })

  it("rejects a signup with a missing name", () => {
    const result = NewUserPurchaseInputSchema.safeParse({ ...base })
    expect(result.success).toBe(false)
  })

  it("accepts a signup with a first and last name", () => {
    const result = NewUserPurchaseInputSchema.safeParse({ ...base, name: "John Doe" })
    expect(result.success).toBe(true)
  })
})
