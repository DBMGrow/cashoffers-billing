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
