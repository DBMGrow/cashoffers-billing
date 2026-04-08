import { z } from "zod"

/**
 * Zod validation schemas for use case inputs
 * Provides runtime type checking and validation
 */

/**
 * Payment validation schemas
 */
export const CreatePaymentInputSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
  amount: z.number().int().min(1, "Amount must be at least 1 cent"),
  email: z.string().email("Invalid email address"),
  memo: z.string().optional(),
  sendEmailOnCharge: z.boolean().optional(),
})

export type CreatePaymentInputValidated = z.infer<typeof CreatePaymentInputSchema>

/**
 * Card validation schemas
 */
export const CreateCardInputSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer").nullable(),
  cardToken: z.string().min(1, "Card token is required"),
  expMonth: z.number().int().min(1).max(12, "Month must be between 1 and 12"),
  expYear: z.number().int().min(2020, "Year must be valid"),
  cardholderName: z.string().min(1, "Cardholder name is required"),
  email: z.string().email("Invalid email address"),
  allowNullUserId: z.boolean().optional(),
  sendEmailOnUpdate: z.boolean().optional(),
  attemptRenewal: z.boolean().optional(),
})

export type CreateCardInputValidated = z.infer<typeof CreateCardInputSchema>

/**
 * Get user card validation schema
 */
export const GetUserCardInputSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
})

export type GetUserCardInputValidated = z.infer<typeof GetUserCardInputSchema>

/**
 * Check user card info validation schema
 */
export const CheckUserCardInfoInputSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
})

export type CheckUserCardInfoInputValidated = z.infer<typeof CheckUserCardInfoInputSchema>

/**
 * Subscription validation schemas
 */
export const CreateSubscriptionInputSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
  productId: z.union([z.number(), z.string().transform((val) => {
    const num = parseInt(val, 10)
    return isNaN(num) ? val : num
  })]),
  email: z.string().email("Invalid email address"),
  userAlreadyExists: z.boolean(),
  waiveSignupFee: z.boolean().optional(),
})

export type CreateSubscriptionInputValidated = z.infer<typeof CreateSubscriptionInputSchema>

export const RenewSubscriptionInputSchema = z.object({
  subscriptionId: z.number().int().positive("Subscription ID must be a positive integer"),
  email: z.string().email("Invalid email address"),
  triggeredBy: z.enum(['cron', 'card_update']).optional(),
})

export type RenewSubscriptionInputValidated = z.infer<typeof RenewSubscriptionInputSchema>

export const UpdateSubscriptionInputSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
  newProductId: z.union([z.number(), z.string().transform((val) => {
    const num = parseInt(val, 10)
    return isNaN(num) ? val : num
  })]),
  email: z.string().email("Invalid email address"),
})

export type UpdateSubscriptionInputValidated = z.infer<typeof UpdateSubscriptionInputSchema>

export const CancelSubscriptionInputSchema = z.object({
  subscriptionId: z.number().int().positive("Subscription ID must be a positive integer"),
  action: z.enum(["cancel", "downgrade"], {
    message: 'Action must be either "cancel" or "downgrade"',
  }),
  email: z.string().email("Invalid email address"),
})

export type CancelSubscriptionInputValidated = z.infer<typeof CancelSubscriptionInputSchema>

/**
 * Refund validation schema
 */
export const RefundPaymentInputSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
  squareTransactionId: z.string().min(1, "Square transaction ID is required"),
  email: z.string().email("Invalid email address").optional(),
})

export type RefundPaymentInputValidated = z.infer<typeof RefundPaymentInputSchema>

/**
 * Get payments validation schema
 */
export const GetPaymentsInputSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer").optional(),
  page: z.number().int().positive("Page must be a positive integer").optional(),
  limit: z.number().int().positive("Limit must be a positive integer").optional(),
  readAll: z.boolean().optional(),
})

export type GetPaymentsInputValidated = z.infer<typeof GetPaymentsInputSchema>

/**
 * Get subscriptions validation schema
 */
export const GetSubscriptionsInputSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer").optional(),
  page: z.number().int().positive("Page must be a positive integer").optional(),
  limit: z.number().int().positive("Limit must be a positive integer").optional(),
})

export type GetSubscriptionsInputValidated = z.infer<typeof GetSubscriptionsInputSchema>

/**
 * Pause subscription validation schema
 */
export const PauseSubscriptionInputSchema = z.object({
  subscriptionId: z.number().int().positive("Subscription ID must be a positive integer"),
})

export type PauseSubscriptionInputValidated = z.infer<typeof PauseSubscriptionInputSchema>

/**
 * Resume subscription validation schema
 */
export const ResumeSubscriptionInputSchema = z.object({
  subscriptionId: z.number().int().positive("Subscription ID must be a positive integer"),
})

export type ResumeSubscriptionInputValidated = z.infer<typeof ResumeSubscriptionInputSchema>

/**
 * Mark subscription for downgrade validation schema
 */
export const MarkForDowngradeInputSchema = z.object({
  subscriptionId: z.number().int().positive("Subscription ID must be a positive integer"),
  downgrade: z.boolean(),
})

export type MarkForDowngradeInputValidated = z.infer<typeof MarkForDowngradeInputSchema>

/**
 * Cancel subscription on renewal validation schema
 */
export const CancelOnRenewalInputSchema = z.object({
  subscriptionId: z.number().int().positive("Subscription ID must be a positive integer"),
  cancel: z.boolean(),
})

export type CancelOnRenewalInputValidated = z.infer<typeof CancelOnRenewalInputSchema>

/**
 * Update subscription fields validation schema
 */
export const UpdateSubscriptionFieldsInputSchema = z.object({
  subscriptionId: z.number().int().positive("Subscription ID must be a positive integer"),
  subscriptionName: z.string().optional(),
  amount: z.number().int().min(1).optional(),
  duration: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
  status: z.string().optional(),
})

export type UpdateSubscriptionFieldsInputValidated = z.infer<typeof UpdateSubscriptionFieldsInputSchema>

/**
 * Deactivate subscription validation schema
 */
export const DeactivateSubscriptionInputSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
})

export type DeactivateSubscriptionInputValidated = z.infer<typeof DeactivateSubscriptionInputSchema>

/**
 * New user purchase validation schema.
 * All card and identification fields are required.
 */
export const NewUserPurchaseInputSchema = z.object({
  productId: z.union([z.number(), z.string().transform((val) => {
    const num = parseInt(val, 10)
    return isNaN(num) ? val : num
  })]),
  email: z.string().email({ message: "Invalid email address" }),
  phone: z.string().min(1, "Phone is required"),
  cardToken: z.string().min(1, "Card token is required").optional().nullable(),
  expMonth: z.number().int().min(1).max(12).optional().nullable(),
  expYear: z.number().int().optional().nullable(),
  cardholderName: z.string().min(1, "Cardholder name is required").optional().nullable(),
  name: z.string().optional().nullable(),
  nameBroker: z.string().optional().nullable(),
  nameTeam: z.string().optional().nullable(),
  whitelabel: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  isInvestor: z.union([z.boolean(), z.number()]).optional().nullable(),
  coupon: z.string().optional().nullable(),
})

export type NewUserPurchaseInputValidated = z.infer<typeof NewUserPurchaseInputSchema>

/**
 * Existing user purchase validation schema.
 * User identity is resolved from the session token.
 * Card fields are optional — card on file is used if omitted.
 */
export const ExistingUserPurchaseInputSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
  productId: z.union([z.number(), z.string().transform((val) => {
    const num = parseInt(val, 10)
    return isNaN(num) ? val : num
  })]),
  email: z.string().email({ message: "Invalid email address" }),
  cardToken: z.string().optional().nullable(),
  expMonth: z.number().int().min(1).max(12).optional().nullable(),
  expYear: z.number().int().optional().nullable(),
  cardholderName: z.string().optional().nullable(),
  coupon: z.string().optional().nullable(),
})

export type ExistingUserPurchaseInputValidated = z.infer<typeof ExistingUserPurchaseInputSchema>

/**
 * Purchase subscription validation schema
 * @deprecated Use NewUserPurchaseInputSchema or ExistingUserPurchaseInputSchema instead
 */
export const PurchaseSubscriptionInputSchema = z.object({
  productId: z.union([z.number(), z.string().transform((val) => {
    const num = parseInt(val, 10)
    return isNaN(num) ? val : num
  })]),
  email: z.string().email({ message: "Invalid email address" }),
  userId: z.number().int().positive().optional(),
  name: z.string().optional(),
  cardToken: z.string().optional(),
  expMonth: z.number().int().min(1).max(12).optional(),
  expYear: z.number().int().optional(),
  cardholderName: z.string().optional(),
  apiToken: z.string().optional(),
  phone: z.string().optional(),
  whitelabel: z.string().optional(),
  slug: z.string().optional(),
  url: z.string().optional(),
  nameBroker: z.string().optional(),
  nameTeam: z.string().optional(),
  isInvestor: z.union([z.boolean(), z.number()]).optional(),
  coupon: z.string().optional(),
})

export type PurchaseSubscriptionInputValidated = z.infer<typeof PurchaseSubscriptionInputSchema>

/**
 * Create product validation schema
 */
export const CreateProductInputSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  productDescription: z.string().optional(),
  productType: z.enum(["none", "one-time", "subscription"] as const),
  price: z.number().int().min(0, "Price must be a non-negative integer"),
  data: z.any().optional(),
})

export type CreateProductInputValidated = z.infer<typeof CreateProductInputSchema>

/**
 * Unlock property validation schema
 */
export const UnlockPropertyInputSchema = z.object({
  propertyToken: z.string().min(1, "Property token is required"),
  cardToken: z.string().min(1, "Card token is required"),
  userId: z.number().int().positive("User ID must be a positive integer"),
  email: z.string().email("Invalid email address"),
})

export type UnlockPropertyInputValidated = z.infer<typeof UnlockPropertyInputSchema>
