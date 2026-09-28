import { db } from "@api/lib/database"
import {
  PRODUCT_NOT_AVAILABLE,
  type LinkedProductOptions,
  checkLinkedProduct,
  isOtherWhitelabelsProduct,
  linkedProductRejectionMessage,
  linkedProductRejectionStatus,
} from "@api/domain/services/product-link.service"

/**
 * Database half of the product-link rules in `product-link.service.ts`, shared
 * by the manage routes (`/manage/enrollment`, `/manage/products`,
 * `/manage/checkplan`, `/manage/purchase`) and `POST /purchase/existing`.
 */

export interface ProductNotAvailableBody {
  success: "error"
  error: string
  code: typeof PRODUCT_NOT_AVAILABLE
}

/** The code of a white label, or null when there is no white label or it has no code. */
export async function resolveWhitelabelCode(whitelabelId: number | null | undefined): Promise<string | null> {
  if (!whitelabelId) return null
  const whitelabel = await db
    .selectFrom("Whitelabels")
    .select("code")
    .where("whitelabel_id", "=", whitelabelId)
    .executeTakeFirst()
  return whitelabel?.code ?? null
}

function notAvailable(reason: Parameters<typeof linkedProductRejectionStatus>[0]) {
  return {
    ok: false as const,
    status: linkedProductRejectionStatus(reason),
    body: {
      success: "error" as const,
      error: linkedProductRejectionMessage(reason),
      code: PRODUCT_NOT_AVAILABLE,
    },
  }
}

/**
 * Loads the product named in a link and applies the strict rule: it exists,
 * its white label is exactly the user's, and it is a subscription product.
 * Hidden products are allowed. `options.homeUptickOnlyAllowed: false` also refuses a
 * `homeuptick_only` product (an Express Offers Guest).
 */
export async function resolveLinkedProduct(
  productId: number,
  userWhitelabelCode: string | null,
  options: LinkedProductOptions = {}
) {
  const product = await db.selectFrom("Products").selectAll().where("product_id", "=", productId).executeTakeFirst()
  const check = checkLinkedProduct(product, userWhitelabelCode, options)
  if (!check.available) return notAvailable(check.reason)
  return { ok: true as const, product: product! }
}

/**
 * The guard every purchase applies to a `product_id` from the request body:
 * refuse a product that belongs to another white label. Returns null when the
 * purchase may proceed, including when the product does not exist (the
 * purchase path reports its own "Product not found").
 */
export async function guardPurchaseWhitelabel(
  productId: number,
  userWhitelabelId: number | null | undefined
): Promise<{ status: 403; body: ProductNotAvailableBody } | null> {
  const product = await db
    .selectFrom("Products")
    .select(["whitelabel_code"])
    .where("product_id", "=", productId)
    .executeTakeFirst()
  if (!product) return null
  const userWhitelabelCode = await resolveWhitelabelCode(userWhitelabelId)
  if (!isOtherWhitelabelsProduct(product.whitelabel_code, userWhitelabelCode)) return null
  return {
    status: 403,
    body: {
      success: "error",
      error: linkedProductRejectionMessage("WHITELABEL_MISMATCH"),
      code: PRODUCT_NOT_AVAILABLE,
    },
  }
}
