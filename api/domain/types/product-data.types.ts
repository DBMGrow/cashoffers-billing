/**
 * Product Data Types
 *
 * These types define the structure of data stored in the JSON fields
 * of Products and Subscriptions tables.
 */

/**
 * User configuration that products provide to CashOffers users
 */
export interface ProductUserConfig {
  /** Premium status: 0 = not premium, 1 = premium */
  is_premium: 0 | 1
  /** User role in the CashOffers system */
  role: "AGENT" | "INVESTOR" | "ADMIN" | "TEAMOWNER" | "SHELL"
  /** White label ID, or null for default white label */
  whitelabel_id: number | null
  /** Indicates if this is a team subscription product */
  is_team_plan?: boolean
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
  /** One-time signup fee in cents */
  signup_fee?: number
  /** Recurring renewal cost in cents */
  renewal_cost?: number
  /** Billing cycle duration */
  duration?: "daily" | "weekly" | "monthly" | "yearly"
  /** Maximum number of team members for team plans */
  team_members?: number
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
  /** Product data snapshot for use in event handlers */
  productData?: ProductData
}
