import type { PaymentContext } from "@api/config/config.interface"

/**
 * Subscription-related DTOs (Data Transfer Objects)
 * These types define the inputs and outputs for subscription use cases
 */

/**
 * Input for creating a subscription
 */
export interface CreateSubscriptionInput {
  userId: number
  productId: string | number
  email: string
  userAlreadyExists: boolean
  waiveSignupFee?: boolean
  context?: PaymentContext
}

/**
 * Output from creating a subscription
 */
export interface CreateSubscriptionOutput {
  subscriptionId: number
  status: string
  renewalDate: Date
  amount: number
}

/**
 * Input for updating a subscription
 */
export interface UpdateSubscriptionInput {
  userId: number
  newProductId: string | number
  email: string
}

/**
 * Output from updating a subscription
 */
export interface UpdateSubscriptionOutput {
  subscriptionId: number
  status: string
  proratedCharge?: number
}

/**
 * Input for updating subscription fields (generic fields update)
 */
export interface UpdateSubscriptionFieldsInput {
  subscriptionId: number
  subscriptionName?: string
  amount?: number
  duration?: "daily" | "weekly" | "monthly" | "yearly"
  status?: string
}

/**
 * Output from updating subscription fields
 */
export interface UpdateSubscriptionFieldsOutput {
  subscriptionId: number
  updated: boolean
}

/**
 * Input for renewing a subscription
 */
export interface RenewSubscriptionInput {
  subscriptionId: number
  email: string
  context?: PaymentContext
}

/**
 * Output from renewing a subscription
 */
export interface RenewSubscriptionOutput {
  subscriptionId: number
  transactionId: string
  nextRenewalDate: Date
  amount: number
}

/**
 * Input for canceling/downgrading a subscription
 */
export interface CancelSubscriptionInput {
  subscriptionId: number
  action: "cancel" | "downgrade"
  email: string
}

/**
 * Output from canceling a subscription
 */
export interface CancelSubscriptionOutput {
  subscriptionId: number
  status: string
  effectiveDate: Date
}

/**
 * Input for pausing a subscription
 */
export interface PauseSubscriptionInput {
  subscriptionId: number
}

/**
 * Output from pausing a subscription
 */
export interface PauseSubscriptionOutput {
  subscriptionId: number
  status: string
}

/**
 * Input for resuming a subscription
 */
export interface ResumeSubscriptionInput {
  subscriptionId: number
}

/**
 * Output from resuming a subscription
 */
export interface ResumeSubscriptionOutput {
  subscriptionId: number
  status: string
}

/**
 * Input for marking subscription for downgrade
 */
export interface MarkForDowngradeInput {
  subscriptionId: number
  downgrade: boolean // true to mark, false to unmark
}

/**
 * Output from marking subscription for downgrade
 */
export interface MarkForDowngradeOutput {
  subscriptionId: number
  downgradeOnRenewal: boolean
}

/**
 * Input for marking subscription for cancellation on renewal
 */
export interface CancelOnRenewalInput {
  subscriptionId: number
  cancel: boolean // true to mark, false to unmark
}

/**
 * Output from marking subscription for cancellation on renewal
 */
export interface CancelOnRenewalOutput {
  subscriptionId: number
  cancelOnRenewal: boolean
}

/**
 * Input for getting subscriptions
 */
export interface GetSubscriptionsInput {
  userId?: number
  page?: number
  limit?: number
}

/**
 * Output from getting subscriptions
 */
export interface GetSubscriptionsOutput {
  subscriptions: Array<{
    subscriptionId: number
    userId: number
    subscriptionName: string
    amount: number
    duration: string
    status: string
    renewalDate: Date | null
    cancelOnRenewal: boolean
    downgradeOnRenewal: boolean
    createdAt: Date
  }>
  total: number
  page: number
  limit: number
}

/**
 * Input for purchasing a subscription (comprehensive flow)
 * @deprecated Use NewUserPurchaseInput or ExistingUserPurchaseInput instead
 */
export interface PurchaseSubscriptionInput {
  // Product & User Info
  productId: string | number
  email: string

  // When provided (existing user via session auth), skips user lookup and creation
  userId?: number

  // Card Info (optional for existing users with cards)
  cardToken?: string | null
  expMonth?: number | null
  expYear?: number | null
  cardholderName?: string | null

  // Existing User Auth
  apiToken?: string | null

  // New User Info
  name?: string | null
  phone?: string | null
  whitelabel?: string | null // Keep for backward compatibility
  slug?: string | null
  url?: string | null
  nameBroker?: string | null
  nameTeam?: string | null
  isInvestor?: boolean | number | null

  // Optional
  coupon?: string | null
  context?: PaymentContext | null
}

/**
 * Output from purchasing a subscription
 */
export interface PurchaseSubscriptionOutput {
  subscriptionId: number
  /** null when user provisioning was deferred (new-user purchase, provisioning failed) */
  userId: number | null
  cardId: string
  productId: string | number
  amount: number
  proratedCharge?: number
  userCreated: boolean
  /** true when the user account exists and is bound to the subscription */
  userProvisioned: boolean
}

/**
 * Input for purchasing a subscription as a new user.
 * All card and user identification fields are required since the user doesn't exist yet.
 */
export interface NewUserPurchaseInput {
  productId: string | number
  email: string
  phone: string
  cardToken: string
  expMonth: number
  expYear: number
  cardholderName: string
  name?: string | null
  nameBroker?: string | null
  nameTeam?: string | null
  whitelabel?: string | null
  slug?: string | null
  url?: string | null
  isInvestor?: boolean | number | null
  coupon?: string | null
  context?: PaymentContext | null
}

/**
 * Input for purchasing a subscription as an existing authenticated user.
 * User identity (userId, email) is resolved from the session token.
 * Card fields are optional — the user's card on file will be used if omitted.
 */
export interface ExistingUserPurchaseInput {
  userId: number
  productId: string | number
  email: string
  cardToken?: string | null
  expMonth?: number | null
  expYear?: number | null
  cardholderName?: string | null
  coupon?: string | null
  context?: PaymentContext | null
}

/**
 * Input for deactivating/deleting a subscription
 */
export interface DeactivateSubscriptionInput {
  userId: number
}

/**
 * Output from deactivating a subscription
 */
export interface DeactivateSubscriptionOutput {
  userId: number
  status: string
}
