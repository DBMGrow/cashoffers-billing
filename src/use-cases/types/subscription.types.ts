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
