import { describe, it, expect } from "vitest"
import {
  isProductHidden,
  isHiddenForWhitelabel,
  isProductVisibleTo,
  filterVisibleProducts,
} from "./product-visibility.service"
import type { ProductData } from "@api/domain/types/product-data.types"

describe("isProductHidden", () => {
  it("returns true when data.hidden is true", () => {
    expect(isProductHidden({ hidden: true })).toBe(true)
  })

  it("returns false when data.hidden is false", () => {
    expect(isProductHidden({ hidden: false })).toBe(false)
  })

  it("returns false when the flag is absent (backward compatible)", () => {
    expect(isProductHidden({ renewal_cost: 175000 })).toBe(false)
  })

  it("returns false for null / undefined data", () => {
    expect(isProductHidden(null)).toBe(false)
    expect(isProductHidden(undefined)).toBe(false)
  })

  it("does not treat truthy non-true values as hidden", () => {
    // Only an explicit boolean true hides a product.
    expect(isProductHidden({ hidden: 1 as unknown as boolean })).toBe(false)
  })
})

describe("isHiddenForWhitelabel", () => {
  it("returns true when the whitelabel is in data.hidden_whitelabels", () => {
    expect(isHiddenForWhitelabel({ hidden_whitelabels: ["yhsgr"] }, "yhsgr")).toBe(true)
  })

  it("returns false when the whitelabel is not in the list", () => {
    expect(isHiddenForWhitelabel({ hidden_whitelabels: ["yhsgr"] }, "kwofferings")).toBe(false)
  })

  it("returns false when no whitelabel is supplied", () => {
    expect(isHiddenForWhitelabel({ hidden_whitelabels: ["yhsgr"] }, null)).toBe(false)
    expect(isHiddenForWhitelabel({ hidden_whitelabels: ["yhsgr"] }, undefined)).toBe(false)
  })

  it("returns false when the flag is absent/empty (backward compatible)", () => {
    expect(isHiddenForWhitelabel({ renewal_cost: 25000 }, "yhsgr")).toBe(false)
    expect(isHiddenForWhitelabel({ hidden_whitelabels: [] }, "yhsgr")).toBe(false)
    expect(isHiddenForWhitelabel(null, "yhsgr")).toBe(false)
  })
})

describe("isProductVisibleTo", () => {
  it("hides a product globally flagged hidden regardless of whitelabel", () => {
    expect(isProductVisibleTo({ hidden: true }, "yhsgr")).toBe(false)
    expect(isProductVisibleTo({ hidden: true }, null)).toBe(false)
  })

  it("hides a product only from the excluded whitelabel", () => {
    const data: ProductData = { hidden_whitelabels: ["yhsgr"] }
    expect(isProductVisibleTo(data, "yhsgr")).toBe(false)
    expect(isProductVisibleTo(data, "kwofferings")).toBe(true)
    expect(isProductVisibleTo(data, null)).toBe(true)
  })

  it("shows a product with no hiding flags", () => {
    expect(isProductVisibleTo({ renewal_cost: 25000 }, "yhsgr")).toBe(true)
    expect(isProductVisibleTo(null, "yhsgr")).toBe(true)
  })
})

describe("filterVisibleProducts", () => {
  const products: Array<{ product_name: string; data: ProductData | null }> = [
    { product_name: "Individual", data: { renewal_cost: 25000 } },
    { product_name: "Custom Team (50)", data: { hidden: true, renewal_cost: 175000 } },
    { product_name: "Small Team", data: { hidden: false, renewal_cost: 85000 } },
    { product_name: "Custom Team (100)", data: { hidden: true } },
    { product_name: "Legacy (no data)", data: null },
  ]

  it("removes only products flagged hidden", () => {
    expect(filterVisibleProducts(products).map((p) => p.product_name)).toEqual([
      "Individual",
      "Small Team",
      "Legacy (no data)",
    ])
  })

  it("preserves the original order of visible products", () => {
    const result = filterVisibleProducts(products)
    expect(result[0].product_name).toBe("Individual")
    expect(result[result.length - 1].product_name).toBe("Legacy (no data)")
  })

  it("returns an empty array when every product is hidden", () => {
    expect(filterVisibleProducts([{ data: { hidden: true } }, { data: { hidden: true } }])).toEqual([])
  })

  it("returns all products when none are hidden", () => {
    const visible = [{ data: { renewal_cost: 1 } }, { data: null }]
    expect(filterVisibleProducts(visible)).toHaveLength(2)
  })

  it("removes whitelabel-excluded products only for that whitelabel", () => {
    const withExclusion: Array<{ product_name: string; data: ProductData | null }> = [
      { product_name: "Individual No Signup", data: { hidden_whitelabels: ["yhsgr"], renewal_cost: 25000 } },
      { product_name: "Small Team", data: { renewal_cost: 85000 } },
    ]
    // Viewed as YHS: the excluded plan is dropped.
    expect(filterVisibleProducts(withExclusion, "yhsgr").map((p) => p.product_name)).toEqual(["Small Team"])
    // Viewed as another whitelabel: both remain.
    expect(filterVisibleProducts(withExclusion, "kwofferings").map((p) => p.product_name)).toEqual([
      "Individual No Signup",
      "Small Team",
    ])
    // No whitelabel supplied: exclusion doesn't apply.
    expect(filterVisibleProducts(withExclusion).map((p) => p.product_name)).toEqual([
      "Individual No Signup",
      "Small Team",
    ])
  })
})
