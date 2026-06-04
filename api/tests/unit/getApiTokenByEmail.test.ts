import { describe, it, expect, vi, beforeEach } from "vitest"

// Chainable query-builder stub defined inside the (hoisted) factory.
vi.mock("@api/lib/database", () => {
  const builder = {
    selectFrom: vi.fn(() => builder),
    select: vi.fn(() => builder),
    where: vi.fn(() => builder),
    executeTakeFirst: vi.fn(),
  }
  return { db: builder }
})

import { getApiTokenByEmail } from "@api/utils/getUserFromToken"
import { db } from "@api/lib/database"

const mDb = db as unknown as {
  selectFrom: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  where: ReturnType<typeof vi.fn>
  executeTakeFirst: ReturnType<typeof vi.fn>
}

describe("getApiTokenByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the api_token for a known email", async () => {
    mDb.executeTakeFirst.mockResolvedValueOnce({ api_token: "tok_abc123" })
    const result = await getApiTokenByEmail("user@example.com")
    expect(result).toBe("tok_abc123")
    expect(mDb.selectFrom).toHaveBeenCalledWith("Users")
    expect(mDb.where).toHaveBeenCalledWith("email", "=", "user@example.com")
  })

  it("returns null when the user is not found", async () => {
    mDb.executeTakeFirst.mockResolvedValueOnce(undefined)
    const result = await getApiTokenByEmail("missing@example.com")
    expect(result).toBeNull()
  })

  it("returns null when the user has no api_token", async () => {
    mDb.executeTakeFirst.mockResolvedValueOnce({ api_token: null })
    const result = await getApiTokenByEmail("noapitoken@example.com")
    expect(result).toBeNull()
  })

  it("returns null (does not throw) when the query fails", async () => {
    mDb.executeTakeFirst.mockRejectedValueOnce(new Error("db down"))
    const result = await getApiTokenByEmail("user@example.com")
    expect(result).toBeNull()
  })
})
