import { describe, it, expect } from "vitest"
import {
  BILLING_GRANDFATHER_CUTOFF,
  parseProductData,
  productHidesBilling,
  shouldSuppressChargeEmails,
} from "./billing-visibility.service"

const AFTER_CUTOFF = new Date("2026-09-15T00:00:00Z")
const BEFORE_CUTOFF = new Date("2026-07-31T23:59:59Z")

describe("parseProductData", () => {
  it("passes an object through", () => {
    expect(parseProductData({ hides_billing: true })).toEqual({ hides_billing: true })
  })

  it("parses a JSON string (Products.data can come back stringified)", () => {
    expect(parseProductData('{"hides_billing":true}')).toEqual({ hides_billing: true })
  })

  it("returns null for invalid JSON", () => {
    expect(parseProductData("{not json")).toBeNull()
  })

  it("returns null for null/undefined/non-object values", () => {
    expect(parseProductData(null)).toBeNull()
    expect(parseProductData(undefined)).toBeNull()
    expect(parseProductData(42)).toBeNull()
    expect(parseProductData('"just a string"')).toBeNull()
  })
})

describe("productHidesBilling", () => {
  it("is true only for an explicit hides_billing === true", () => {
    expect(productHidesBilling({ hides_billing: true })).toBe(true)
    expect(productHidesBilling({ hides_billing: false })).toBe(false)
    expect(productHidesBilling({ hides_billing: "true" as unknown as boolean })).toBe(false)
    expect(productHidesBilling({})).toBe(false)
    expect(productHidesBilling(null)).toBe(false)
    expect(productHidesBilling(undefined)).toBe(false)
  })
})

describe("shouldSuppressChargeEmails", () => {
  it("suppresses for a hides_billing product and a post-cutoff account", () => {
    expect(shouldSuppressChargeEmails({ hides_billing: true }, AFTER_CUTOFF)).toBe(true)
  })

  it("does NOT suppress for a grandfathered (pre-cutoff) account", () => {
    expect(shouldSuppressChargeEmails({ hides_billing: true }, BEFORE_CUTOFF)).toBe(false)
  })

  it("treats an account created exactly at the cutoff as hidden (>=)", () => {
    expect(shouldSuppressChargeEmails({ hides_billing: true }, BILLING_GRANDFATHER_CUTOFF)).toBe(true)
  })

  it("does NOT suppress when the product doesn't hide billing", () => {
    expect(shouldSuppressChargeEmails({}, AFTER_CUTOFF)).toBe(false)
    expect(shouldSuppressChargeEmails({ hides_billing: false }, AFTER_CUTOFF)).toBe(false)
    expect(shouldSuppressChargeEmails(null, AFTER_CUTOFF)).toBe(false)
  })

  it("accepts an ISO string creation date (user API returns created_at as string)", () => {
    expect(shouldSuppressChargeEmails({ hides_billing: true }, "2026-09-15T00:00:00Z")).toBe(true)
    expect(shouldSuppressChargeEmails({ hides_billing: true }, "2026-07-01T00:00:00Z")).toBe(false)
  })

  it("fails open (sends email) when the creation date is missing or unparseable", () => {
    expect(shouldSuppressChargeEmails({ hides_billing: true }, null)).toBe(false)
    expect(shouldSuppressChargeEmails({ hides_billing: true }, undefined)).toBe(false)
    expect(shouldSuppressChargeEmails({ hides_billing: true }, "not-a-date")).toBe(false)
  })
})
