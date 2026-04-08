import { describe, it, expect } from "vitest"
import formatPhone from "../formatPhone"

describe("formatPhone", () => {
  it("should format complete phone numbers correctly", () => {
    expect(formatPhone("1234567890")).toBe("(123) 456-7890")
    expect(formatPhone("9876543210")).toBe("(987) 654-3210")
  })

  it("should format partial phone numbers", () => {
    expect(formatPhone("123")).toBe("(123")
    expect(formatPhone("1234")).toBe("(123) 4")
    expect(formatPhone("123456")).toBe("(123) 456")
    expect(formatPhone("1234567")).toBe("(123) 456-7")
  })

  it("should strip non-digit characters", () => {
    expect(formatPhone("(123) 456-7890")).toBe("(123) 456-7890")
    expect(formatPhone("123-456-7890")).toBe("(123) 456-7890")
    expect(formatPhone("123.456.7890")).toBe("(123) 456-7890")
    expect(formatPhone("abc123def456ghi7890")).toBe("(123) 456-7890")
  })

  it("should handle empty input", () => {
    expect(formatPhone("")).toBe("")
  })

  it("should handle numbers longer than 10 digits", () => {
    expect(formatPhone("12345678901234")).toBe("(123) 456-7890")
  })
})
