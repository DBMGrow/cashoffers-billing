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
 * Input for renewing a subscription
 */
export interface RenewSubscriptionInput {
  subscriptionId: number
  email: string
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
 */
export interface PurchaseSubscriptionInput {
  // Product & User Info
  productId: string | number
  email: string

  // Card Info (optional for existing users with cards)
  cardToken?: string
  expMonth?: number
  expYear?: number
  cardholderName?: string

  // Existing User Auth
  apiToken?: string

  // New User Info
  phone?: string
  whitelabel?: string
  slug?: string
  url?: string
  isInvestor?: boolean

  // Optional
  coupon?: string
}

/**
 * Output from purchasing a subscription
 */
export interface PurchaseSubscriptionOutput {
  subscriptionId: number
  userId: number
  cardId: string
  productId: string | number
  amount: number
  proratedCharge?: number
  userCreated: boolean
}
