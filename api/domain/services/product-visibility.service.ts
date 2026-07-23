/**
 * Product Visibility Service
 *
 * Pure predicates that decide whether a product should appear in the billing
 * platform's self-service plan lists (the change-plan screen and signup).
 *
 * Two independent hiding rules, both stored in the product `data` JSON:
 *  - `data.hidden = true` hides a product from EVERY customer (used for
 *    admin-created custom pricing shared via a direct link).
 *  - `data.hidden_whitelabels = ["code", …]` hides a product only from the
 *    listed whitelabels, while it stays visible to all others (used to pull a
 *    shared / NULL-whitelabel plan from one whitelabel's view).
 *
 * A product is shown to a viewer only when NEITHER rule hides it. Hidden
 * products remain fully purchasable via a direct admin-shared link —
 * checkplan/purchase by `product_id` do not consult these flags.
 */

import type { ProductData } from "@api/domain/types/product-data.types"

/**
 * Returns true when a product is flagged to be hidden from ALL self-service
 * plan lists. Products without the flag are treated as visible (backward
 * compatible).
 */
export function isProductHidden(data: ProductData | null | undefined): boolean {
  return data?.hidden === true
}

/**
 * Returns true when a product is hidden from the given whitelabel via
 * `data.hidden_whitelabels`. Returns false when no whitelabel is supplied or
 * the flag is absent/empty (backward compatible).
 */
export function isHiddenForWhitelabel(
  data: ProductData | null | undefined,
  whitelabelCode: string | null | undefined
): boolean {
  if (!whitelabelCode) return false
  const list = data?.hidden_whitelabels
  return Array.isArray(list) && list.includes(whitelabelCode)
}

/**
 * Returns true when a product should be shown to a viewer on the given
 * whitelabel — i.e. neither the global `hidden` flag nor a per-whitelabel
 * exclusion applies.
 */
export function isProductVisibleTo(
  data: ProductData | null | undefined,
  whitelabelCode: string | null | undefined
): boolean {
  return !isProductHidden(data) && !isHiddenForWhitelabel(data, whitelabelCode)
}

/**
 * Filters out products hidden from the given whitelabel (or, when no whitelabel
 * is supplied, only globally hidden products), preserving order. Products with
 * no hiding flags are left untouched.
 */
export function filterVisibleProducts<T extends { data: unknown }>(products: T[], whitelabelCode?: string | null): T[] {
  return products.filter((product) => isProductVisibleTo(product.data as ProductData | null, whitelabelCode))
}
