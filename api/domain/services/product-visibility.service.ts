/**
 * Product Visibility Service
 *
 * Pure predicates that decide whether a product should appear in the billing
 * platform's self-service plan lists (the change-plan screen and signup).
 *
 * Admins mark custom-pricing products with `data.hidden = true` so they are not
 * shown to every customer. Hidden products remain fully purchasable via a direct
 * admin-shared link — checkplan/purchase by `product_id` do not consult this flag.
 */

import type { ProductData } from "@api/domain/types/product-data.types"

/**
 * Returns true when a product is flagged to be hidden from self-service plan
 * lists. Products without the flag are treated as visible (backward compatible).
 */
export function isProductHidden(data: ProductData | null | undefined): boolean {
  return data?.hidden === true
}

/**
 * Filters out products flagged as hidden, preserving order. Leaves products
 * without the flag untouched.
 */
export function filterVisibleProducts<T extends { data: unknown }>(products: T[]): T[] {
  return products.filter((product) => !isProductHidden(product.data as ProductData | null))
}
