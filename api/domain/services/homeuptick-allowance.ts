/**
 * HomeUptick allowance
 *
 * The one source of the HomeUptick defaults a product falls back to when its `homeuptick` block
 * leaves a field out, and the one reading of a product's allowance for display. Pure and free of
 * path aliases, so the account site imports it too (`@/api/domain/services/homeuptick-allowance`):
 * the enrollment step used to carry its own defaults, and its 1000 contacts per tier disagreed with
 * the 500 the purchase actually seeds.
 */

import type { HomeUptickConfig } from "../types/product-data.types"

/** What `seedHomeUptickSubscription` seeds for a field the product's template leaves out. */
export const HOMEUPTICK_DEFAULTS = {
  base_contacts: 500,
  contacts_per_tier: 500,
  /** Cents. */
  price_per_tier: 7500,
} as const

export interface HomeUptickAllowance {
  /** Contacts included in the plan price. 0 means every contact is billed (Express Offers Pro). */
  included: number
  /** Contacts in each billed tier beyond `included`. */
  perTier: number
  /** Price of each billed tier, in cents. */
  tierPrice: number
}

/**
 * A product's HomeUptick allowance, or `null` when the product does not turn HomeUptick on (the
 * account site then shows no contact lines at all).
 */
export function homeUptickAllowance(
  homeuptick: Partial<HomeUptickConfig> | null | undefined
): HomeUptickAllowance | null {
  if (!homeuptick?.enabled) return null
  return {
    included: homeuptick.base_contacts ?? HOMEUPTICK_DEFAULTS.base_contacts,
    perTier: homeuptick.contacts_per_tier ?? HOMEUPTICK_DEFAULTS.contacts_per_tier,
    tierPrice: homeuptick.price_per_tier ?? HOMEUPTICK_DEFAULTS.price_per_tier,
  }
}
