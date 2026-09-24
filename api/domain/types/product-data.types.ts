import type { RoleV2 } from "@api/domain/services/role-v2"

/**
 * Product Data Types
 *
 * These types define the structure of data stored in the JSON fields
 * of Products and Subscriptions tables.
 */

/**
 * User configuration that products provide to CashOffers users.
 *
 * Invariant, enforced by `ProductUserConfigSchema` in `api/routes/product/schemas.ts`: a config
 * names at least one of `role_v2` and `role`. A config that names neither would provision a user
 * with no role at all, which fails silently, the account is created and simply cannot do anything.
 */
export interface ProductUserConfig {
  /**
   * The CashOffers role this product puts its subscriber on, RBAC unification plan CO-I271 §9.4.
   *
   * Authoritative when present. It exists because `(role, is_premium)` below cannot express the
   * difference between a $49 Express Offers Pro and a $299 Elite: both are `AGENT` + `is_premium 1`,
   * so on the legacy pair the two products are the same product and reconcile to one another.
   *
   * Optional, and `role` is kept beside it, because the two repos must not have to deploy together
   * (plan §9.4 "Order"). A product written before the backfill carries only `role`; the dashboard
   * product form writes both; Phase 9 (U91) removes `role` and `is_premium` and makes this required.
   */
  role_v2?: RoleV2
  /** Premium status: 0 = not premium, 1 = premium. Legacy half of the pair; `role_v2` wins. */
  is_premium?: 0 | 1
  /** User role in the CashOffers system. Legacy half of the pair; `role_v2` wins. */
  role?: "AGENT" | "INVESTOR" | "ADMIN" | "TEAMOWNER" | "SHELL" | "HOMEUPTICK"
  /** Indicates if this is a team subscription product */
  is_team_plan?: boolean
  /** Maximum number of team members for team plans */
  team_members?: number
  /** Associated whitelabel ID for suspension-behavior resolution */
  whitelabel_id?: number
}

export interface CashOffersConfig {
  /** true = billing manages CO account, false = CO managed externally */
  managed: boolean
  /** Only used when managed: true */
  user_config?: ProductUserConfig
}

export interface HomeUptickFreeTrial {
  enabled: boolean
  /** Contact limit during trial */
  contacts: number
  /** Trial length in days */
  duration_days: number
}

export interface HomeUptickConfig {
  enabled: boolean
  base_contacts?: number
  contacts_per_tier?: number
  /** Cost per tier in cents */
  price_per_tier?: number
  free_trial?: HomeUptickFreeTrial
}

/**
 * Data stored in Products.data JSON field
 */
export interface ProductData {
  /**
   * When true, the product is hidden from the billing platform's self-service
   * plan lists (the change-plan screen and signup). Used for admin-created
   * custom pricing that should stay purchasable via a direct admin-shared link
   * but not be shown to every customer. Absent/false = visible (default).
   */
  hidden?: boolean
  /**
   * Whitelabel codes for which this product is hidden from the self-service
   * plan lists, while remaining visible to every other whitelabel. Used to pull
   * a shared (whitelabel_code = NULL) plan from one whitelabel's view without
   * duplicating it per whitelabel. Absent/empty = visible to all (default).
   * Independent of `hidden`: a product is shown only if neither rule hides it.
   */
  hidden_whitelabels?: string[]
  /**
   * Third-Party Billing Phase 0: corporate pays for this product's subscribers,
   * so they get no self-service billing surface. The dashboard hides the Billing
   * tab for these users (dashboard-mono `computeHideBilling`), and this service
   * suppresses charge-confirmation emails for them — the charged card isn't
   * theirs. Toggled per product from the product admin screen, never hardcoded.
   * Absent/false = normal billing visibility (default).
   */
  hides_billing?: boolean
  /** One-time signup fee in cents */
  signup_fee?: number
  /** Recurring renewal cost in cents */
  renewal_cost?: number
  /** Billing cycle duration */
  duration?: "daily" | "weekly" | "monthly" | "yearly"
  /** Legacy: user config at root level (backward compat) */
  user_config?: ProductUserConfig
  /** CashOffers module configuration */
  cashoffers?: CashOffersConfig
  /** HomeUptick module configuration */
  homeuptick?: HomeUptickConfig
}

/**
 * Data stored in Subscriptions.data JSON field
 */
export interface SubscriptionData {
  /** User configuration copied from product, can be customized per subscription */
  user_config?: ProductUserConfig
  /** CashOffers module configuration copied from product */
  cashoffers?: CashOffersConfig
  /** Product data snapshot for use in event handlers */
  productData?: ProductData
}
