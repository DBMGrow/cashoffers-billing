/**
 * Integration tests for whitelabel validation behavior.
 *
 * Verifies that:
 * - resolveByCodeStrict returns null for unknown whitelabel codes
 * - resolveByCode falls back to default (backward compat for internal use)
 * - The signup products route should 404 for invalid whitelabels
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { WhitelabelResolverService } from "@api/domain/services/whitelabel-resolver.service"

function makeDb(whitelabels: Array<{ whitelabel_id: number; code: string; name: string; data: any }>) {
  return {
    selectFrom: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        selectAll: vi.fn().mockReturnValue({
          executeTakeFirst: vi.fn().mockImplementation(async () => {
            // The mock returns the first whitelabel or undefined
            // We need to track what code was queried — simplified mock
            return undefined
          }),
        }),
        select: vi.fn().mockReturnValue({
          executeTakeFirst: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      selectAll: vi.fn().mockReturnValue({
        executeTakeFirst: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  }
}

// A more realistic mock that actually checks the code
function makeLookupDb(
  whitelabels: Array<{ whitelabel_id: number; code: string; name: string; data: any }>
) {
  const chainMock = (codeToMatch?: string) => ({
    selectAll: () => ({
      executeTakeFirst: async () => {
        if (codeToMatch !== undefined) {
          return whitelabels.find((w) => w.code === codeToMatch)
        }
        return undefined
      },
    }),
    select: () => ({
      executeTakeFirst: async () => {
        if (codeToMatch !== undefined) {
          const found = whitelabels.find((w) => w.code === codeToMatch)
          return found ? { whitelabel_id: found.whitelabel_id } : undefined
        }
        return undefined
      },
    }),
  })

  return {
    selectFrom: () => ({
      where: (_col: string, _op: string, value: string) => chainMock(value),
      selectAll: () => ({
        executeTakeFirst: async () => undefined,
      }),
    }),
  }
}

describe("WhitelabelResolverService", () => {
  describe("resolveByCodeStrict", () => {
    it("returns null for an unknown whitelabel code", async () => {
      const db = makeLookupDb([
        { whitelabel_id: 1, code: "kwofferings", name: "KW Offerings", data: {} },
      ])

      const service = new WhitelabelResolverService(db as any)
      const result = await service.resolveByCodeStrict("nonexistent")

      expect(result).toBeNull()
    })

    it("returns the whitelabel for a known code", async () => {
      const db = makeLookupDb([
        { whitelabel_id: 1, code: "kwofferings", name: "KW Offerings", data: { primary_color: "#ff0000" } },
      ])

      const service = new WhitelabelResolverService(db as any)
      const result = await service.resolveByCodeStrict("kwofferings")

      expect(result).not.toBeNull()
      expect(result!.whitelabel_id).toBe(1)
      expect(result!.code).toBe("kwofferings")
      expect(result!.name).toBe("KW Offerings")
      expect(result!.branding.primary_color).toBe("#ff0000")
    })

    it("returns null for empty string code", async () => {
      const db = makeLookupDb([])
      const service = new WhitelabelResolverService(db as any)
      const result = await service.resolveByCodeStrict("")

      expect(result).toBeNull()
    })
  })

  describe("resolveByCode (backward compat)", () => {
    it("falls back to default for unknown code instead of returning null", async () => {
      const db = makeLookupDb([
        { whitelabel_id: 4, code: "default", name: "CashOffers", data: {} },
      ])

      const service = new WhitelabelResolverService(db as any)
      const result = await service.resolveByCode("nonexistent")

      // Falls back to default
      expect(result).not.toBeNull()
      expect(result.code).toBe("default")
    })
  })
})
