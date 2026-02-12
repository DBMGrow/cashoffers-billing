import { describe, it, expect, vi, beforeEach } from "vitest"
import getUniqueSlug from "../getUniqueSlug"

describe("getUniqueSlug", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return a slug for a valid name", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            success: "success",
            data: { slug: "john-doe" },
          }),
      })
    ) as any

    const result = await getUniqueSlug("John Doe")
    expect(result).toBe("john-doe")
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/signup/getuniqueslug?name=John%20Doe")
    )
  })

  it("should return null on API failure", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            success: null, // Will trigger the !data?.success check
            data: null,
          }),
      })
    ) as any

    const result = await getUniqueSlug("Test Name")
    expect(result).toBeNull()
  })

  it("should return null on network error", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("Network error"))) as any

    const result = await getUniqueSlug("Test Name")
    expect(result).toBeNull()
  })

  it("should handle special characters in name", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            success: "success",
            data: { slug: "john-oshea" },
          }),
      })
    ) as any

    const result = await getUniqueSlug("John O'Shea")
    expect(result).toBe("john-oshea")
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/signup/getuniqueslug?name=John%20O'Shea")
    )
  })
})
