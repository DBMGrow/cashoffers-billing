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
  role: "AGENT" | "INVESTOR" | "ADMIN" | "TEAMOWNER"
  /** White label ID, or null for default white label */
  white_label_id: number | null
  /** Indicates if this is a team subscription product */
  is_team_plan?: boolean
}

/**
 * Data stored in Products.data JSON field
 */
export interface ProductData {
  // Existing fields (from current usage)
  /** One-time signup fee in cents */
  signup_fee?: number
  /** Recurring renewal cost in cents */
  renewal_cost?: number
  /** Billing cycle duration */
  duration?: "daily" | "weekly" | "monthly" | "yearly"

  // New user configuration
  /** Configuration applied to users when they purchase this product */
  user_config?: ProductUserConfig
}

/**
 * Data stored in Subscriptions.data JSON field
 */
export interface SubscriptionData {
  /** User configuration copied from product, can be customized per subscription */
  user_config?: ProductUserConfig
}
