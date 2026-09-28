/**
 * Promo code evaluation: whether a code applies to a purchase, and what it takes off the first charge.
 *
 * Pure: no database, no clock (the caller passes `now`), no Square. The purchase use cases call it
 * inside the redemption lock (so the counts it sees cannot race), and the public validate endpoint
 * calls it to quote the price. Both get the same answer because both run this function.
 *
 * Money is in cents (docs/business/decisions/amounts-in-cents.md).
 *
 * What a discount touches, and what it never does:
 *
 * - It lowers the **initial charge only** (`initialAmount`). `Subscriptions.amount` stays the list
 *   renewal cost, because reconciliation matches `renewal_cost === subscription.amount`
 *   (api/domain/services/product-matching.ts) and renewals charge `amount`.
 * - `applies_to = "first_period"` discounts the first billing period (the `renewalCost` part of the
 *   signup charge) and leaves any signup fee alone. `"first_charge"` discounts the whole initial
 *   charge, signup fee included.
 * - A discount never takes the charge below 0.
 * - `free_periods` greater than 1, or `duration_periods` greater than 1, is recorded on the
 *   redemption (`periodsRemaining`) for a later renewal phase. Today only the first charge is
 *   discounted, so the display text promises only the first period.
 */

export type PromoDiscountType = "free_periods" | "percent" | "amount"
export type PromoAppliesTo = "first_period" | "first_charge"

/** A promo code row, parsed (JSON columns decoded, tinyints as booleans). */
export interface PromoDefinition {
  promo_id: number
  code: string
  description?: string | null
  whitelabel_code: string | null
  product_ids: number[] | null
  product_roles: string[] | null
  discount_type: PromoDiscountType
  discount_value: number
  applies_to: PromoAppliesTo
  duration_periods: number
  max_redemptions: number | null
  max_per_user: number
  starts_at: Date | null
  ends_at: Date | null
  active: boolean
  new_users_only: boolean
  campaign?: string | null
}

export interface PromoPricingInput {
  signupFee: number
  renewalCost: number
  productDuration: string
  initialAmount: number
}

export interface PromoEvaluationContext {
  product: { product_id: number; whitelabel_code: string | null; role_v2?: string | null }
  pricing: PromoPricingInput
  now: Date
  /** Non-voided redemptions of this code by this buyer (email or user id). */
  priorRedemptionsForUser: number
  /** Non-voided redemptions of this code by everyone. */
  totalRedemptions: number
  /**
   * False when the buyer already has or had a paid subscription. Only read when the code is
   * `new_users_only`. Undefined is treated as new (the validate endpoint does not know the buyer).
   */
  isNewCustomer?: boolean
}

export type PromoRejectionReason =
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "WRONG_WHITELABEL"
  | "WRONG_PRODUCT"
  | "EXHAUSTED"
  | "ALREADY_USED"
  | "NEW_USERS_ONLY"
  | "NO_DISCOUNT"

export interface PromoRejection {
  ok: false
  reason: PromoRejectionReason
  /** Customer-facing sentence. */
  message: string
}

export interface PromoApplication {
  ok: true
  promoId: number
  code: string
  /** Initial charge before the discount. */
  originalAmount: number
  discountAmount: number
  /** What is charged today. */
  chargedAmount: number
  /** What each renewal charges (the list renewal cost). */
  thenAmount: number
  /** Short label, e.g. "First month free". */
  display: string
  /** Full sentence, e.g. "Promo EXPCON: First month free, $0.00 today, then $49.00/mo". */
  summary: string
  periodsTotal: number
  periodsRemaining: number
}

export type PromoEvaluation = PromoRejection | PromoApplication

export const PROMO_REJECTION_MESSAGES: Record<PromoRejectionReason, string> = {
  NOT_FOUND: "That promo code isn't valid.",
  INACTIVE: "That promo code is no longer active.",
  NOT_STARTED: "That promo code isn't active yet.",
  EXPIRED: "That promo code has expired.",
  WRONG_WHITELABEL: "That promo code doesn't apply to this plan.",
  WRONG_PRODUCT: "That promo code doesn't apply to this plan.",
  EXHAUSTED: "That promo code has reached its redemption limit.",
  ALREADY_USED: "You've already used that promo code.",
  NEW_USERS_ONLY: "That promo code is for new members only.",
  NO_DISCOUNT: "That promo code doesn't apply to this plan.",
}

/** Codes are stored uppercase and matched case-insensitively. */
export function normalizePromoCode(code: string | null | undefined): string | null {
  const trimmed = (code ?? "").trim().toUpperCase()
  return trimmed.length > 0 ? trimmed : null
}

export function rejectPromo(reason: PromoRejectionReason): PromoRejection {
  return { ok: false, reason, message: PROMO_REJECTION_MESSAGES[reason] }
}

const PERIOD_NOUN: Record<string, string> = { daily: "day", weekly: "week", monthly: "month", yearly: "year" }
const PERIOD_ABBR: Record<string, string> = { daily: "day", weekly: "wk", monthly: "mo", yearly: "yr" }

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function describeDiscount(promo: PromoDefinition, pricing: PromoPricingInput): string {
  const noun = PERIOD_NOUN[pricing.productDuration] ?? "month"
  const waivesFee = promo.applies_to === "first_charge" && pricing.signupFee > 0
  const scope = promo.applies_to === "first_charge" ? "first payment" : `first ${noun}`
  switch (promo.discount_type) {
    case "free_periods":
      return waivesFee ? `First ${noun} free, no signup fee` : `First ${noun} free`
    case "percent":
      return promo.discount_value >= 100 ? `${capitalize(scope)} free` : `${promo.discount_value}% off your ${scope}`
    case "amount":
      return `${formatCents(promo.discount_value)} off your ${scope}`
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function evaluatePromo(promo: PromoDefinition | null, ctx: PromoEvaluationContext): PromoEvaluation {
  if (!promo) return rejectPromo("NOT_FOUND")
  if (!promo.active) return rejectPromo("INACTIVE")
  if (promo.starts_at && ctx.now < promo.starts_at) return rejectPromo("NOT_STARTED")
  if (promo.ends_at && ctx.now >= promo.ends_at) return rejectPromo("EXPIRED")

  if (
    promo.whitelabel_code &&
    promo.whitelabel_code.toUpperCase() !== (ctx.product.whitelabel_code ?? "").toUpperCase()
  ) {
    return rejectPromo("WRONG_WHITELABEL")
  }
  if (promo.product_ids && promo.product_ids.length > 0 && !promo.product_ids.includes(ctx.product.product_id)) {
    return rejectPromo("WRONG_PRODUCT")
  }
  if (promo.product_roles && promo.product_roles.length > 0) {
    if (!ctx.product.role_v2 || !promo.product_roles.includes(ctx.product.role_v2)) return rejectPromo("WRONG_PRODUCT")
  }

  if (promo.max_redemptions != null && ctx.totalRedemptions >= promo.max_redemptions) return rejectPromo("EXHAUSTED")
  if (promo.max_per_user > 0 && ctx.priorRedemptionsForUser >= promo.max_per_user) return rejectPromo("ALREADY_USED")
  if (promo.new_users_only && ctx.isNewCustomer === false) return rejectPromo("NEW_USERS_ONLY")

  const { pricing } = ctx
  // The part of today's charge the discount may touch.
  const base =
    promo.applies_to === "first_charge" ? pricing.initialAmount : Math.min(pricing.renewalCost, pricing.initialAmount)
  if (base <= 0) return rejectPromo("NO_DISCOUNT")

  let discount: number
  switch (promo.discount_type) {
    case "free_periods":
      discount = promo.discount_value > 0 ? base : 0
      break
    case "percent":
      discount = Math.round((base * Math.min(Math.max(promo.discount_value, 0), 100)) / 100)
      break
    case "amount":
      discount = Math.min(Math.max(promo.discount_value, 0), base)
      break
    default:
      discount = 0
  }
  if (discount <= 0) return rejectPromo("NO_DISCOUNT")

  const chargedAmount = Math.max(pricing.initialAmount - discount, 0)
  const discountAmount = pricing.initialAmount - chargedAmount
  const periodsTotal = Math.max(
    promo.discount_type === "free_periods" ? promo.discount_value : promo.duration_periods || 1,
    1
  )
  const display = describeDiscount(promo, pricing)
  const abbr = PERIOD_ABBR[pricing.productDuration] ?? "mo"

  return {
    ok: true,
    promoId: promo.promo_id,
    code: promo.code,
    originalAmount: pricing.initialAmount,
    discountAmount,
    chargedAmount,
    thenAmount: pricing.renewalCost,
    display,
    summary: `Promo ${promo.code}: ${display}, ${formatCents(chargedAmount)} today, then ${formatCents(pricing.renewalCost)}/${abbr}`,
    periodsTotal,
    periodsRemaining: periodsTotal - 1,
  }
}
