import { describe, it, expect, vi, beforeEach } from "vitest"
import { WhitelabelResolverService } from "./whitelabel-resolver.service"
import type { IUserApiClient } from "@api/infrastructure/external-api/user-api.interface"

// Minimal Kysely-shaped DB mock — only the query chain used by resolveForUser
const makeDbMock = (whitelabelCode: string | null) => ({
  selectFrom: vi.fn().mockReturnValue({
    innerJoin: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          executeTakeFirst: vi.fn().mockResolvedValue(
            whitelabelCode ? { whitelabel_code: whitelabelCode } : undefined
          ),
        }),
      }),
    }),
    where: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnValue({
      executeTakeFirst: vi.fn().mockResolvedValue({
        whitelabel_id: 99,
        code: "iop",
        name: "kw InstantOffers.PRO",
        data: {},
      }),
    }),
  }),
})

const makeWhitelabelDbRow = (code: string, name: string) => ({
  selectFrom: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnValue({
      executeTakeFirst: vi.fn().mockResolvedValue({
        whitelabel_id: code === "instantoffers" ? 1 : 2,
        code,
        name,
        data: {},
      }),
    }),
    innerJoin: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          executeTakeFirst: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
  }),
})

const makeUserApiClient = (whitelabelId: number | undefined): IUserApiClient =>
  ({
    getUser: vi.fn().mockResolvedValue({ whitelabel_id: whitelabelId }),
  }) as unknown as IUserApiClient

describe("WhitelabelResolverService.resolveForUser", () => {
  describe("priority 1: user profile whitelabel_id", () => {
    it("uses the user's whitelabel_id when set, ignoring the subscription product", async () => {
      // DB returns kw Offerings for the subscription's product
      const db = makeWhitelabelDbRow("instantoffers", "Instant Offers") as any
      // But the user's profile says Instant Offers (whitelabel_id = 1)
      const userApiClient = makeUserApiClient(1)

      const service = new WhitelabelResolverService(db, userApiClient)
      const result = await service.resolveForUser(42)

      expect(result.code).toBe("instantoffers")
      expect(result.name).toBe("Instant Offers")
      expect(userApiClient.getUser).toHaveBeenCalledWith(42)
    })

    it("falls through to subscription product when user has no whitelabel_id", async () => {
      const db = makeDbMock("kwofferings") as any
      // DB also needs to resolve the code to a whitelabel row
      db.selectFrom.mockImplementation((table: string) => {
        if (table === "Whitelabels") {
          return {
            where: vi.fn().mockReturnThis(),
            selectAll: vi.fn().mockReturnValue({
              executeTakeFirst: vi.fn().mockResolvedValue({
                whitelabel_id: 2,
                code: "kwofferings",
                name: "kw Offerings",
                data: {},
              }),
            }),
          }
        }
        return {
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue({ whitelabel_code: "kwofferings" }),
              }),
            }),
          }),
        }
      })

      const userApiClient = makeUserApiClient(undefined)
      const service = new WhitelabelResolverService(db, userApiClient)
      const result = await service.resolveForUser(42)

      expect(result.code).toBe("kwofferings")
    })

    it("falls through to subscription product when no userApiClient is provided", async () => {
      const db = makeDbMock(null) as any
      db.selectFrom.mockImplementation((_table: string) => ({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              executeTakeFirst: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }),
        where: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnValue({
          executeTakeFirst: vi.fn().mockResolvedValue({
            whitelabel_id: 4,
            code: "default",
            name: "CashOffers",
            data: {},
          }),
        }),
      }))

      const service = new WhitelabelResolverService(db)
      const result = await service.resolveForUser(42)

      expect(result.code).toBe("default")
    })
  })

  describe("Mike Cook scenario", () => {
    it("sends Instant Offers email even when subscription product is kwofferings", async () => {
      // Simulates: user.whitelabel_id = InstantOffers, subscription.product.whitelabel_code = kwofferings
      const db = makeWhitelabelDbRow("instantoffers", "Instant Offers") as any
      const userApiClient = makeUserApiClient(1) // InstantOffers whitelabel_id

      const service = new WhitelabelResolverService(db, userApiClient)
      const result = await service.resolveForUser(/* Mike Cook's userId */ 999)

      expect(result.name).toBe("Instant Offers")
      expect(result.code).toBe("instantoffers")
    })
  })
})
