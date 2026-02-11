import { z } from "zod"
import {
  SuccessResponseSchema,
  ErrorResponseSchema,
  EmailSchema,
  PositiveIntSchema,
  AmountSchema,
} from "./common.schemas"

/**
 * Purchase route schemas
 * Handles new subscription purchases with user creation
 */

// ==================== Request Schemas ====================

/**
 * Purchase subscription request body
 * Comprehensive endpoint for creating new subscriptions (with user creation if needed)
 */
export const PurchaseRequestSchema = z.object({
  product_id: z.union([z.number(), z.string()]).transform((val) =>
    typeof val === "string" ? parseInt(val, 10) : val
  ),
  email: EmailSchema,
  card_token: z.string().optional(),
  exp_month: z.union([z.string(), z.number()]).optional(),
  exp_year: z.union([z.string(), z.number()]).optional(),
  cardholder_name: z.string().optional(),
  api_token: z.string().optional(),
  phone: z.string().optional(),
  whitelabel: z.string().optional(),
  slug: z.string().optional(),
  url: z.string().optional(),
  isInvestor: z.boolean().optional(),
  coupon: z.string().optional(),
})

// ==================== Response Schemas ====================

/**
 * Subscription details in purchase response
 */
export const PurchaseSubscriptionSchema = z.object({
  subscriptionId: z.number(),
  userId: z.number(),
  productId: z.union([z.number(), z.string()]),
  amount: z.number(),
})

/**
 * Product details (returned from repository)
 */
export const PurchaseProductSchema = z.object({
  product_id: z.number(),
  product_name: z.string(),
  product_description: z.string().nullable(),
  product_type: z.string(),
  price: z.number(),
  data: z.record(z.string(), z.any()).nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
})

/**
 * User details (returned from API)
 */
export const PurchaseUserSchema = z.object({
  user_id: z.number(),
  email: z.string(),
  phone: z.string().nullable().optional(),
  active: z.union([z.number(), z.boolean()]).optional(),
  // Allow additional user fields
}).passthrough()

/**
 * User card details
 */
export const PurchaseUserCardSchema = z.object({
  id: z.number(),
  user_id: z.number().nullable(),
  card_id: z.string(),
  last_4: z.string(),
  card_brand: z.string(),
  exp_month: z.string(),
  exp_year: z.string(),
  cardholder_name: z.string().nullable(),
  square_customer_id: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
})

/**
 * Purchase subscription response (custom format with enhanced data)
 */
export const PurchaseResponseSchema = z.object({
  success: z.literal("success"),
  data: z.object({
    subscription: PurchaseSubscriptionSchema,
    product: PurchaseProductSchema.nullable(),
    user: PurchaseUserSchema.nullable(),
    userCard: PurchaseUserCardSchema.nullable(),
    userCreated: z.boolean(),
    proratedCharge: z.number().nullable().optional(),
  }),
  environment: z.enum(["sandbox", "production"]),
})

// ==================== OpenAPI Route Definitions ====================

/**
 * POST /purchase - Create new subscription purchase
 */
export const PurchaseRoute = {
  method: "post" as const,
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: PurchaseRequestSchema,
          example: {
            product_id: 1,
            email: "user@example.com",
            card_token: "cnon:card-nonce-ok",
            exp_month: "12",
            exp_year: "2025",
            cardholder_name: "John Doe",
            phone: "+1234567890",
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PurchaseResponseSchema,
        },
      },
      description: "Subscription purchase successful",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or purchase failed",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Purchase"],
  summary: "Purchase subscription",
  description:
    "Create a new subscription purchase. Creates user if they don't exist. Handles card creation, prorated charges for upgrades, and subscription activation. Requires payments_create permission.",
}
