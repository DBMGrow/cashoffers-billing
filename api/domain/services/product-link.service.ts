/**
 * Product Link Service
 *
 * Pure predicates for a product named explicitly in a link, as opposed to one
 * picked from a category list. The CashOffers dashboard sends an agent to
 * `/manage?goto=<enrollment|changePlan>&product=<id>` to buy the one product
 * that is their upgrade (for example an Express Offers Guest buying
 * "Express Offers Pro"), so the server has to decide whether the named product
 * may be sold to the signed-in user without consulting the category logic.
 *
 * Two rules live here, and they are deliberately different:
 *
 * 1. `checkLinkedProduct`, the strict rule for a product named in a link. The
 *    product's `whitelabel_code` must equal the user's white label code
 *    exactly, and a NULL on either side matches only a NULL on the other. A
 *    NULL-white-label product is the platform's own (CashOffers) product; an
 *    upgrade link for an eXp agent must never resolve to it, because the role
 *    it writes is a CashOffers tier, not an eXp one. A user whose white label
 *    has no code of its own (or who has no white label) is a platform user, so
 *    for them the platform's NULL products are the exact match. The hiding
 *    flags (`data.hidden`, `data.hidden_whitelabels`) are NOT consulted: an
 *    explicit link is how a hidden product is sold.
 *
 * 2. `isOtherWhitelabelsProduct`, the looser guard every purchase applies.
 *    It only refuses a product that belongs to a DIFFERENT white label. It
 *    allows a NULL-white-label product for any user because the existing plan
 *    lists (`GET /manage/products`, `GET /manage/enrollment` without
 *    `product`) have always offered shared NULL products to every white label,
 *    and a purchase guard stricter than the lists would break those purchases.
 *    What it closes is a hand-edited `product_id` buying another white label's
 *    product, which no list ever offered.
 */

export interface LinkableProduct {
  whitelabel_code: string | null
  product_type: string
}

export type LinkedProductRejection = "NOT_FOUND" | "WHITELABEL_MISMATCH" | "NOT_SUBSCRIPTION"

export type LinkedProductCheck = { available: true } | { available: false; reason: LinkedProductRejection }

/** The error code every rejected product link answers with. */
export const PRODUCT_NOT_AVAILABLE = "PRODUCT_NOT_AVAILABLE"

/**
 * Whether a product named in a link may be sold to a user on the given white
 * label code. `userWhitelabelCode` is the code of the user's white label, or
 * null when the user has no white label or it has no code.
 */
export function checkLinkedProduct(
  product: LinkableProduct | null | undefined,
  userWhitelabelCode: string | null
): LinkedProductCheck {
  if (!product) return { available: false, reason: "NOT_FOUND" }
  if ((product.whitelabel_code ?? null) !== (userWhitelabelCode ?? null)) {
    return { available: false, reason: "WHITELABEL_MISMATCH" }
  }
  if (product.product_type !== "subscription") return { available: false, reason: "NOT_SUBSCRIPTION" }
  return { available: true }
}

/**
 * True when the product belongs to a white label other than the user's. A
 * product with no white label is shared and never counts as another's.
 */
export function isOtherWhitelabelsProduct(
  productWhitelabelCode: string | null | undefined,
  userWhitelabelCode: string | null | undefined
): boolean {
  if (productWhitelabelCode == null) return false
  return productWhitelabelCode !== (userWhitelabelCode ?? null)
}

/** The HTTP status a rejection answers with: 404 for a missing product, 403 for one this user may not buy. */
export function linkedProductRejectionStatus(reason: LinkedProductRejection): 403 | 404 {
  return reason === "NOT_FOUND" ? 404 : 403
}

/** The user-facing message for a rejection. Never names another white label. */
export function linkedProductRejectionMessage(reason: LinkedProductRejection): string {
  switch (reason) {
    case "NOT_FOUND":
      return "The requested product does not exist"
    case "WHITELABEL_MISMATCH":
      return "The requested product is not available for your account"
    case "NOT_SUBSCRIPTION":
      return "The requested product is not a subscription plan"
  }
}
