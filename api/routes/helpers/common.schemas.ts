import { z } from "zod"

/**
 * Common schemas used across all API routes
 * Provides consistent validation patterns and response structures
 */

// ==================== Response Wrappers ====================

/**
 * Standard success response wrapper
 * Usage: SuccessResponseSchema(z.object({ field: z.string() }))
 */
export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal("success"),
    data: dataSchema,
  })

/**
 * Standard error response
 */
export const ErrorResponseSchema = z.object({
  success: z.literal("error"),
  error: z.string(),
  code: z.string().optional(),
})

// ==================== Common Field Validators ====================

/**
 * Positive integer validator with coercion
 * Converts string numbers to integers
 */
export const PositiveIntSchema = z.coerce.number().int().positive()

/**
 * Email validator
 */
export const EmailSchema = z.string().email("Invalid email address")

/**
 * Phone number validator (optional)
 */
export const PhoneSchema = z.string().optional()

// ==================== Pagination ====================

/**
 * Standard pagination query parameters
 * Defaults: page=1, limit=20
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

/**
 * Pagination response metadata
 */
export const PaginationResponseSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
})

// ==================== Common Parameter Schemas ====================

/**
 * User ID parameter (from URL path)
 */
export const UserIdParamSchema = z.object({
  user_id: PositiveIntSchema,
})

/**
 * Subscription ID parameter (from URL path)
 */
export const SubscriptionIdParamSchema = z.object({
  subscription_id: PositiveIntSchema,
})

/**
 * Product ID parameter (from URL path)
 */
export const ProductIdParamSchema = z.object({
  product_id: PositiveIntSchema,
})

/**
 * Property token parameter (from URL path)
 */
export const PropertyTokenParamSchema = z.object({
  property_token: z.string().min(1, "Property token is required"),
})

// ==================== Common Request Fields ====================

/**
 * User ID in request body
 */
export const UserIdBodySchema = z.object({
  user_id: PositiveIntSchema,
})

/**
 * Amount in cents (positive integer)
 */
export const AmountSchema = z.coerce.number().int().min(1, "Amount must be at least 1 cent")

// ==================== Payment Context ====================

/**
 * Square environment enum
 */
export const SquareEnvironmentSchema = z.enum(["sandbox", "production"])

/**
 * Payment context in responses
 */
export const PaymentContextSchema = z.object({
  environment: SquareEnvironmentSchema,
  isTestMode: z.boolean(),
})

// ==================== Common Enums ====================

/**
 * Transaction/Payment status
 */
export const TransactionStatusSchema = z.enum(["completed", "failed", "pending", "refunded"])

/**
 * Transaction type
 */
export const TransactionTypeSchema = z.enum([
  "payment",
  "subscription",
  "refund",
  "property_unlock",
])

// ==================== Type Exports ====================

export type SuccessResponse<T> = {
  success: "success"
  data: T
}

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
export type PaginationResponse = z.infer<typeof PaginationResponseSchema>
