/**
 * Whitelabel Resolver Service
 *
 * Resolves whitelabel information for users based on their subscriptions
 * or explicitly provided whitelabel_id
 */

import { Kysely } from "kysely"
import type { DB } from "@api/lib/db"
import { WhitelabelData } from "@api/domain/types/whitelabel-data.types"
import type { IUserApiClient } from "@api/infrastructure/external-api/user-api.interface"

export interface ResolvedWhitelabel {
  whitelabel_id: number
  code: string
  name: string
  branding: WhitelabelData
}

const DEFAULT_BRANDING: WhitelabelData = {
  primary_color: "#4d9cb9",
  secondary_color: "#ec8b33",
  logo_url: "/assets/logos/default-logo.png",
  marketing_website: "https://instantoffers.pro",
  support_email: "support@cashoffers.pro",
  billing_url: "https://account.cashoffers.pro",
}

export class WhitelabelResolverService {
  constructor(
    private db: Kysely<DB>,
    private userApiClient?: IUserApiClient
  ) {}

  /**
   * Resolve whitelabel for a user.
   *
   * Priority order:
   * 1. User's whitelabel_id (admin-managed, source of truth)
   * 2. whitelabel_code on the product tied to the user's latest active subscription
   * 3. Default whitelabel
   */
  async resolveForUser(userId: number): Promise<ResolvedWhitelabel> {
    try {
      // 1. Prefer the user's explicitly assigned whitelabel_id (via user API)
      if (this.userApiClient) {
        const user = await this.userApiClient.getUser(userId)
        if (user?.whitelabel_id) {
          return this.resolveById(user.whitelabel_id)
        }
      }

      // 1.5. Fall back to whitelabel_id on the Users table in the billing DB.
      // This covers free/whitelabel users who have no active paid subscription —
      // the user API may not return whitelabel_id, but the DB is authoritative.
      const dbUser = await this.db
        .selectFrom("Users")
        .where("user_id", "=", userId)
        .select(["whitelabel_id"])
        .executeTakeFirst()

      if (dbUser?.whitelabel_id) {
        const resolved = await this.resolveById(dbUser.whitelabel_id)
        // Only use the DB user's whitelabel if it resolves to something
        // non-default (code !== "default"), avoiding a no-op fallthrough.
        if (resolved.code !== "default") {
          return resolved
        }
      }

      // 2. Fall back to the whitelabel_code on the user's active subscription's product
      const subscription = await this.db
        .selectFrom("Subscriptions")
        .innerJoin("Products", "Products.product_id", "Subscriptions.product_id")
        .where("Subscriptions.user_id", "=", userId)
        .where("Subscriptions.status", "=", "active")
        .select(["Products.whitelabel_code"])
        .orderBy("Subscriptions.subscription_id", "desc")
        .executeTakeFirst()

      if (subscription?.whitelabel_code) {
        return this.resolveByCode(subscription.whitelabel_code)
      }

      return this.resolveDefault()
    } catch (error) {
      console.error("Error resolving whitelabel for user", { userId, error })
      return this.resolveDefault()
    }
  }

  /**
   * Resolve whitelabel by explicit ID
   */
  async resolveById(whitelabelId: number): Promise<ResolvedWhitelabel> {
    try {
      const whitelabel = await this.db
        .selectFrom("Whitelabels")
        .where("whitelabel_id", "=", whitelabelId)
        .selectAll()
        .executeTakeFirst()

      if (!whitelabel) {
        return this.resolveDefault()
      }

      return {
        whitelabel_id: whitelabel.whitelabel_id,
        code: whitelabel.code,
        name: whitelabel.name,
        branding: {
          ...DEFAULT_BRANDING,
          ...((whitelabel.data as Record<string, unknown>) || {}),
        } as WhitelabelData,
      }
    } catch (error) {
      console.error("Error resolving whitelabel by ID", { whitelabelId, error })
      return this.resolveDefault()
    }
  }

  /**
   * Resolve whitelabel by code (falls back to default if not found)
   */
  async resolveByCode(code: string): Promise<ResolvedWhitelabel> {
    try {
      const whitelabel = await this.db.selectFrom("Whitelabels").where("code", "=", code).selectAll().executeTakeFirst()

      if (!whitelabel) {
        return this.resolveDefault()
      }

      return {
        whitelabel_id: whitelabel.whitelabel_id,
        code: whitelabel.code,
        name: whitelabel.name,
        branding: {
          ...DEFAULT_BRANDING,
          ...((whitelabel.data as Record<string, unknown>) || {}),
        } as WhitelabelData,
      }
    } catch (error) {
      console.error("Error resolving whitelabel by code", { code, error })
      return this.resolveDefault()
    }
  }

  /**
   * Resolve whitelabel by code — strict mode.
   * Returns null if the whitelabel code does not exist in the database.
   * Used by public-facing routes (landing/signup) where an invalid code should 404.
   */
  async resolveByCodeStrict(code: string): Promise<ResolvedWhitelabel | null> {
    const whitelabel = await this.db.selectFrom("Whitelabels").where("code", "=", code).selectAll().executeTakeFirst()

    if (!whitelabel) {
      return null
    }

    return {
      whitelabel_id: whitelabel.whitelabel_id,
      code: whitelabel.code,
      name: whitelabel.name,
      branding: {
        ...DEFAULT_BRANDING,
        ...((whitelabel.data as Record<string, unknown>) || {}),
      } as WhitelabelData,
    }
  }

  /**
   * Get default whitelabel (CashOffers)
   */
  private async resolveDefault(): Promise<ResolvedWhitelabel> {
    try {
      const whitelabel = await this.db
        .selectFrom("Whitelabels")
        .where("code", "=", "default")
        .selectAll()
        .executeTakeFirst()

      if (whitelabel) {
        return {
          whitelabel_id: whitelabel.whitelabel_id,
          code: whitelabel.code,
          name: whitelabel.name,
          branding: {
            ...DEFAULT_BRANDING,
            ...((whitelabel.data as Record<string, unknown>) || {}),
          } as WhitelabelData,
        }
      }

      // Hardcoded fallback
      return {
        whitelabel_id: 4,
        code: "default",
        name: "CashOffers",
        branding: DEFAULT_BRANDING,
      }
    } catch (error) {
      // Ultimate fallback
      return {
        whitelabel_id: 4,
        code: "default",
        name: "CashOffers",
        branding: DEFAULT_BRANDING,
      }
    }
  }
}

/**
 * Create a whitelabel resolver service instance
 */
export const createWhitelabelResolverService = (db: Kysely<DB>, userApiClient?: IUserApiClient): WhitelabelResolverService => {
  return new WhitelabelResolverService(db, userApiClient)
}
