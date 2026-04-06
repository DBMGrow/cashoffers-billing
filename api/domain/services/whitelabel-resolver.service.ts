/**
 * Whitelabel Resolver Service
 *
 * Resolves whitelabel information for users based on their subscriptions
 * or explicitly provided whitelabel_id
 */

import { Kysely } from "kysely"
import type { DB } from "@api/lib/db"
import { WhitelabelData } from "@api/domain/types/whitelabel-data.types"

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
  billing_url: "https://billing.cashoffers.pro",
}

export class WhitelabelResolverService {
  constructor(private db: Kysely<DB>) {}

  /**
   * Resolve whitelabel for a user by looking up their subscriptions
   */
  async resolveForUser(userId: number): Promise<ResolvedWhitelabel> {
    try {
      // Get the user's latest active subscription
      const subscription = await this.db
        .selectFrom("Subscriptions")
        .innerJoin("Products", "Products.product_id", "Subscriptions.product_id")
        .where("Subscriptions.user_id", "=", userId)
        .where("Subscriptions.status", "=", "active")
        .select(["Subscriptions.data as subscription_data", "Products.data as product_data"])
        .orderBy("Subscriptions.subscription_id", "desc")
        .executeTakeFirst()

      if (subscription) {
        // Check if subscription or product has whitelabel_id in user_config
        const subData = (subscription.subscription_data as any) || {}
        const prodData = (subscription.product_data as any) || {}

        const whitelabelId =
          subData.user_config?.whitelabel_id ??
          subData.user_config?.white_label_id ??
          prodData.user_config?.whitelabel_id ??
          prodData.user_config?.white_label_id

        if (whitelabelId) {
          return this.resolveById(whitelabelId)
        }
      }

      // Fall back to default whitelabel
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
          ...(whitelabel.data || {}),
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
          ...(whitelabel.data || {}),
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
        ...(whitelabel.data || {}),
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
            ...(whitelabel.data || {}),
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
export const createWhitelabelResolverService = (db: Kysely<DB>): WhitelabelResolverService => {
  return new WhitelabelResolverService(db)
}
