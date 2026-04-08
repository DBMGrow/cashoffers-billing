import { describe, it, expect } from "vitest"
import validateEmail from "../validateEmail"

describe("validateEmail", () => {
  it("should return true for valid email addresses", () => {
    expect(validateEmail("test@example.com")).toBe(true)
    expect(validateEmail("user.name@example.com")).toBe(true)
    expect(validateEmail("user+tag@example.co.uk")).toBe(true)
    expect(validateEmail("123@example.com")).toBe(true)
  })

  it("should return false for invalid email addresses", () => {
    expect(validateEmail("notanemail")).toBe(false)
    expect(validateEmail("@example.com")).toBe(false)
    expect(validateEmail("user@")).toBe(false)
    expect(validateEmail("user@.com")).toBe(false)
    expect(validateEmail("user @example.com")).toBe(false)
  })

  it("should return false for empty string", () => {
    expect(validateEmail("")).toBe(false)
  })

  it("should handle edge cases", () => {
    expect(validateEmail("user@example")).toBe(false) // no TLD
    expect(validateEmail("user..name@example.com")).toBe(true) // double dot (technically valid)
  })
})
