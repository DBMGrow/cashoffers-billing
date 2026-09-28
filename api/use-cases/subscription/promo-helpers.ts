import { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { PromoCodeRepository, PurchaseRequestRepository, SubscriptionRepository } from "@api/lib/repositories"
import { evaluatePromo, normalizePromoCode, rejectPromo } from "@api/domain/services/promo-evaluation"
import type { PromoEvaluation } from "@api/domain/services/promo-evaluation"
import { resolveUserConfigRoleV2 } from "@api/domain/services/role-v2"
import type { ProductData } from "@api/domain/types/product-data.types"
import { PurchaseError, PurchasePricing, calculatePricing } from "./purchase-helpers"

/**
 * Promo codes inside the two purchase flows.
 *
 * Order in a purchase, and why:
 * 1. `applyPromoToPurchase` runs after the product and list pricing are known and BEFORE any card is
 *    charged. It reserves a redemption under a row lock (count limits hold under concurrency) and
 *    returns the discounted pricing. A code that does not apply fails the purchase here with
 *    PROMO_CODE_INVALID (user-facing, 400), so nobody is silently charged full price.
 * 2. The flow keeps the card requirement from the undiscounted price: a promo'd $0 still saves a card,
 *    or the first renewal would have nothing to charge.
 * 3. `attachPromoRedemption` links the redemption to the subscription once it exists.
 * 4. `releasePromoReservation` voids the reservation when the purchase fails before anything was
 *    charged or created, so a retry can redeem.
 */

export const PROMO_ERROR_CODE = "PROMO_CODE_INVALID"

export interface PromoDeps {
  logger: ILogger
  promoCodeRepository: PromoCodeRepository
  purchaseRequestRepository: PurchaseRequestRepository
}

/** True when the user has never had a paid subscription (every row is $0, or there are none). */
export async function isNewCustomerForPromo(
  deps: { subscriptionRepository: Pick<SubscriptionRepository, "findByUserId"> },
  userId: number
): Promise<boolean> {
  const subscriptions = await deps.subscriptionRepository.findByUserId(userId)
  return !subscriptions.some((sub) => Number(sub.amount) > 0)
}

export async function applyPromoToPurchase(
  deps: PromoDeps,
  params: {
    coupon: string | null | undefined
    email: string
    userId: number | null
    purchaseRequestId: number
    product: { product_id: number; whitelabel_code: string | null }
    roleV2: string | null
    pricing: PurchasePricing
    /** Resolved lazily: only a code that is `new_users_only` needs it, but it is cheap. */
    isNewCustomer: boolean
    now?: Date
  }
): Promise<PurchasePricing> {
  const code = normalizePromoCode(params.coupon)
  if (!code) return params.pricing

  const { evaluation, redemptionId } = await deps.promoCodeRepository.reserve({
    code,
    email: params.email,
    userId: params.userId,
    purchaseRequestId: params.purchaseRequestId,
    productId: params.product.product_id,
    whitelabelCode: params.product.whitelabel_code,
    decide: (promo, counts) =>
      evaluatePromo(promo, {
        product: { ...params.product, role_v2: params.roleV2 },
        pricing: params.pricing,
        now: params.now ?? new Date(),
        priorRedemptionsForUser: counts.forUser,
        totalRedemptions: counts.total,
        isNewCustomer: params.isNewCustomer,
      }),
  })

  if (!evaluation.ok || redemptionId == null) {
    const reason = evaluation.ok ? "NOT_RESERVED" : evaluation.reason
    const message = evaluation.ok ? "That promo code could not be applied." : evaluation.message
    deps.logger.warn("Promo code refused", { code, reason, purchaseRequestId: params.purchaseRequestId })
    await deps.purchaseRequestRepository.markAsFailed(
      params.purchaseRequestId,
      `Promo ${code}: ${reason}`,
      PROMO_ERROR_CODE
    )
    throw new PurchaseError(message, PROMO_ERROR_CODE)
  }

  deps.logger.info("Promo code applied", {
    code,
    redemptionId,
    purchaseRequestId: params.purchaseRequestId,
    originalAmount: evaluation.originalAmount,
    discountAmount: evaluation.discountAmount,
    chargedAmount: evaluation.chargedAmount,
  })

  return {
    ...params.pricing,
    initialAmount: evaluation.chargedAmount,
    promo: {
      code: evaluation.code,
      redemptionId,
      display: evaluation.display,
      originalAmount: evaluation.originalAmount,
      discountAmount: evaluation.discountAmount,
    },
  }
}

/** Links a redemption to its subscription. Never throws: the purchase already succeeded. */
export async function attachPromoRedemption(
  deps: { logger: ILogger; promoCodeRepository: PromoCodeRepository },
  pricing: PurchasePricing,
  subscriptionId: number,
  userId: number | null
): Promise<void> {
  if (!pricing.promo) return
  try {
    await deps.promoCodeRepository.attachSubscription(pricing.promo.redemptionId, subscriptionId, userId)
  } catch (error) {
    deps.logger.error("Failed to link promo redemption to subscription", {
      redemptionId: pricing.promo.redemptionId,
      subscriptionId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/** Records the provisioned user on a new signup's redemption. Never throws. */
export async function setPromoRedemptionUser(
  deps: { logger: ILogger; promoCodeRepository: PromoCodeRepository },
  pricing: PurchasePricing | null,
  userId: number
): Promise<void> {
  if (!pricing?.promo) return
  try {
    await deps.promoCodeRepository.setUserId(pricing.promo.redemptionId, userId)
  } catch (error) {
    deps.logger.error("Failed to set user on promo redemption", {
      redemptionId: pricing.promo.redemptionId,
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Voids the reservation when the purchase failed before any charge and before the subscription
 * existed. A redemption whose purchase took money or created a subscription stays, so the report
 * shows it for manual resolution. Never throws.
 */
export async function releasePromoReservation(
  deps: { logger: ILogger; promoCodeRepository: PromoCodeRepository },
  pricing: PurchasePricing | null,
  state: { paymentTaken: boolean; subscriptionCreated: boolean }
): Promise<void> {
  if (!pricing?.promo || state.paymentTaken || state.subscriptionCreated) return
  try {
    await deps.promoCodeRepository.voidRedemption(pricing.promo.redemptionId)
  } catch (error) {
    deps.logger.error("Failed to void promo redemption", {
      redemptionId: pricing.promo.redemptionId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Quotes a code for the checkout screens (GET /purchase/promo/validate). Same evaluation as a
 * purchase, minus the buyer: per-user limits and `new_users_only` are checked again at purchase,
 * where the buyer is known. Never reserves anything.
 */
export async function quotePromo(
  deps: {
    productRepository: {
      findById: (
        id: number
      ) => Promise<{ product_id: number; price: number; whitelabel_code: string | null; data: unknown } | null>
    }
    promoCodeRepository: Pick<PromoCodeRepository, "findByCode" | "countRedemptions">
  },
  params: { code: string; productId: number; flow: "signup" | "manage"; now?: Date }
): Promise<PromoEvaluation> {
  const code = normalizePromoCode(params.code)
  if (!code) return rejectPromo("NOT_FOUND")

  const product = await deps.productRepository.findById(params.productId)
  if (!product) return rejectPromo("WRONG_PRODUCT")
  const productData = (typeof product.data === "object" && product.data !== null ? product.data : {}) as ProductData
  const userConfig = productData.cashoffers?.user_config ?? productData.user_config

  const promo = await deps.promoCodeRepository.findByCode(code)
  const totalRedemptions = promo ? await deps.promoCodeRepository.countRedemptions(promo.promo_id) : 0

  return evaluatePromo(promo, {
    product: {
      product_id: product.product_id,
      whitelabel_code: product.whitelabel_code,
      role_v2: resolveUserConfigRoleV2(userConfig),
    },
    pricing: calculatePricing(product, productData, { existingUser: params.flow === "manage" }),
    now: params.now ?? new Date(),
    priorRedemptionsForUser: 0,
    totalRedemptions,
  })
}
