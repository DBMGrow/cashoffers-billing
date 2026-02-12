import { z } from "zod"
import { ErrorResponseSchema, EmailSchema } from "./common.schemas"

/**
 * Signup route schemas
 * Handles user registration and signup validation
 */

// ==================== Request Schemas ====================

/**
 * Free purchase (user registration) request body
 */
export const PurchaseFreeRequestSchema = z.object({
  email: EmailSchema,
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  name_broker: z.string().optional(),
  name_team: z.string().optional(),
  slug: z.string().optional(),
  whitelabel: z.string().optional(),
  isInvestor: z.boolean().optional(),
})

// ==================== Response Schemas ====================

/**
 * Free purchase response
 */
export const PurchaseFreeResponseSchema = z.object({
  data: z.object({
    success: z.string(),
    data: z.any().optional(),
    message: z.string().optional(),
  }),
})

/**
 * Check user exists response
 */
export const CheckUserExistsResponseSchema = z.object({
  success: z.literal("success"),
  userExists: z.boolean(),
  hasCard: z.boolean().optional(),
  canSetUpCard: z.boolean().optional(),
  plan: z.number().optional(),
  offerDowngrade: z.boolean().optional(),
})

/**
 * Check slug exists response
 */
export const CheckSlugExistsResponseSchema = z.object({
  success: z.literal("success"),
  userExists: z.boolean(),
})

// ==================== OpenAPI Route Definitions ====================

/**
 * POST /signup/purchasefree - Register free user
 */
export const PurchaseFreeRoute = {
  method: "post" as const,
  path: "/purchasefree",
  request: {
    body: {
      content: {
        "application/json": {
          schema: PurchaseFreeRequestSchema,
          example: {
            email: "user@example.com",
            name: "John Doe",
            phone: "+1234567890",
            isInvestor: false,
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PurchaseFreeResponseSchema,
        },
      },
      description: "User registration successful",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or registration failed",
    },
  },
  tags: ["Signup"],
  summary: "Register free user",
  description:
    "Creates a new user account without a paid subscription. Used for free tier signups.",
}

/**
 * GET /signup/checkuserexists/:email - Check if user exists
 */
export const CheckUserExistsRoute = {
  method: "get" as const,
  path: "/checkuserexists/:email",
  request: {
    params: z.object({
      email: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CheckUserExistsResponseSchema,
        },
      },
      description: "User check successful",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request",
    },
  },
  tags: ["Signup"],
  summary: "Check if user exists",
  description:
    "Checks if a user exists by email. Returns additional information about user's subscription status and card setup requirements.",
}

/**
 * GET /signup/checkslugexists/:slug - Check if slug exists
 */
export const CheckSlugExistsRoute = {
  method: "get" as const,
  path: "/checkslugexists/:slug",
  request: {
    params: z.object({
      slug: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CheckSlugExistsResponseSchema,
        },
      },
      description: "Slug check successful",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request",
    },
  },
  tags: ["Signup"],
  summary: "Check if slug exists",
  description:
    "Checks if a team slug is already taken. Used during team registration to validate slug availability.",
}
