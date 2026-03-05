import { z } from "zod"
import { ErrorResponseSchema, EmailSchema } from "../helpers/common.schemas"

/**
 * Purchase route schemas
 */

// ==================== Request Schemas ====================

/**
 * New user purchase request body.
 * Used by POST /purchase/new — no auth required.
 * All user and card fields are required since the user doesn't exist yet.
 */
export const NewUserPurchaseRequestSchema = z.object({
  product_id: z.union([z.number(), z.string()]).transform((val) => (typeof val === "string" ? parseInt(val, 10) : val)),
  email: EmailSchema,
  phone: z.string(),
  card_token: z.string(),
  exp_month: z.union([z.string(), z.number()]),
  exp_year: z.union([z.string(), z.number()]),
  cardholder_name: z.string(),
  name: z.string().optional().nullable(),
  name_broker: z.string().optional().nullable(),
  name_team: z.string().optional().nullable(),
  whitelabel: z.string().optional().nullable(),
  slug: z.string().optional(),
  url: z.string().optional(),
  coupon: z.string().optional().nullable(),
  isInvestor: z.union([z.number(), z.boolean()]).optional().nullable(),
  mock_purchase: z.boolean().optional().nullable(),
})

/**
 * Existing user purchase request body.
 * Used by POST /purchase/existing — requires session auth (x-api-token header or _api_token cookie).
 * User identity (userId, email) is resolved from the session token by authMiddleware.
 */
export const ExistingUserPurchaseRequestSchema = z.object({
  product_id: z.union([z.number(), z.string()]).transform((val) => (typeof val === "string" ? parseInt(val, 10) : val)),
  card_token: z.string().optional().nullable(),
  exp_month: z.union([z.string(), z.number()]).optional().nullable(),
  exp_year: z.union([z.string(), z.number()]).optional().nullable(),
  cardholder_name: z.string().optional().nullable(),
  coupon: z.string().optional().nullable(),
  mock_purchase: z.boolean().optional().nullable(),
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
  reset_token: z.string(),
})

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
 * Shared purchase response schema
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
 * POST /purchase/new — Create subscription for a new user
 * Public endpoint: no auth required, creates the user as part of the flow.
 */
export const NewUserPurchaseRoute = {
  method: "post" as const,
  path: "/new",
  request: {
    body: {
      content: {
        "application/json": {
          schema: NewUserPurchaseRequestSchema,
          example: {
            product_id: 1,
            email: "user@example.com",
            phone: "+1234567890",
            card_token: "cnon:card-nonce-ok",
            exp_month: "12",
            exp_year: "2025",
            cardholder_name: "John Doe",
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: PurchaseResponseSchema } },
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
  summary: "Purchase subscription (new user)",
  description:
    "Create a new subscription for a new user. Creates the user account, charges the provided card, and activates the subscription.",
}

/**
 * POST /purchase/existing — Create subscription for an authenticated existing user
 * Requires session auth: x-api-token header or _api_token cookie.
 * User identity is resolved from the session token — no email or user fields needed in the body.
 */
export const ExistingUserPurchaseRoute = {
  method: "post" as const,
  path: "/existing",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ExistingUserPurchaseRequestSchema,
          example: {
            product_id: 1,
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: PurchaseResponseSchema } },
      description: "Subscription purchase successful",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or purchase failed",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized — missing or invalid session token",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Purchase"],
  summary: "Purchase subscription (existing user)",
  description:
    "Create a new subscription for an authenticated existing user. Requires a valid session token via x-api-token header or _api_token cookie. Optionally provide new card details to update the card on file.",
}
