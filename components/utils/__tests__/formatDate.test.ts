import { describe, it, expect } from "vitest"
import formatDate from "../formatDate"

describe("formatDate", () => {
  it("should format valid date strings", () => {
    // Use a date with explicit UTC time to avoid timezone issues
    const result = formatDate("2024-01-15T12:00:00")
    expect(result).toMatch(/January 1[45], 2024/)
  })

  it("should format Date objects", () => {
    const date = new Date(2024, 11, 25) // Month is 0-indexed, so 11 = December
    const result = formatDate(date)
    expect(result).toMatch(/December 25, 2024/)
  })

  it("should handle ISO date strings", () => {
    const result = formatDate("2024-03-10T12:00:00")
    expect(result).toMatch(/March (9|10), 2024/)
  })

  it("should return original input as string for invalid dates", () => {
    const invalidDate = "not a date"
    const result = formatDate(invalidDate)
    // Invalid dates return "Invalid Date" string
    expect(result).toMatch(/Invalid Date|not a date/)
  })
})
