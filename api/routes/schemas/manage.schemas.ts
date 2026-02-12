import { z } from "zod"
import { ErrorResponseSchema } from "./common.schemas"

/**
 * Manage route schemas
 * Handles subscription management and account operations
 */

// ==================== Request Schemas ====================

/**
 * Check plan request body
 */
export const CheckPlanRequestSchema = z.object({
  subscription: z.object({
    user_id: z.number(),
    data: z
      .object({
        team: z.boolean().optional(),
        team_id: z.number().optional(),
      })
      .passthrough()
      .optional(),
  }),
  productID: z.union([z.number(), z.string()]).transform((val) =>
    typeof val === "string" ? parseInt(val, 10) : val
  ),
})

// ==================== Response Schemas ====================

/**
 * User details in response
 */
export const UserResponseSchema = z.object({
  user_id: z.number(),
  email: z.string(),
  name: z.string().optional(),
  phone: z.string().nullable().optional(),
  role: z.string().optional(),
  active: z.union([z.number(), z.boolean()]).optional(),
  is_premium: z.union([z.number(), z.boolean()]).optional(),
  team_id: z.number().nullable().optional(),
  whitelabel_id: z.number().nullable().optional(),
  // Allow additional fields
}).passthrough()

/**
 * Check plan response
 */
export const CheckPlanResponseSchema = z.object({
  success: z.literal("success"),
  data: z.object({
    team: z.any().optional(),
    teamUsers: z
      .array(
        z.object({
          id: z.number(),
          email: z.string(),
          name: z.string(),
        })
      )
      .optional(),
    numberOfUsers: z.number().optional(),
    product: z.any(),
    proratedCost: z.any(),
  }),
})

/**
 * Check token response
 */
export const CheckTokenResponseSchema = z.object({
  success: z.literal("success"),
  tokenValid: z.boolean(),
  data: UserResponseSchema,
})

// ==================== OpenAPI Route Definitions ====================

/**
 * POST /manage/checkplan - Check if user can switch plans
 */
export const CheckPlanRoute = {
  method: "post" as const,
  path: "/checkplan",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CheckPlanRequestSchema,
          example: {
            subscription: {
              user_id: 123,
              data: {
                team: true,
                team_id: 456,
              },
            },
            productID: 1,
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CheckPlanResponseSchema,
        },
      },
      description: "Plan check successful",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Manage"],
  summary: "Check if user can switch plans",
  description:
    "Validates whether a user can switch to a different subscription plan. Checks team size limits and calculates prorated costs.",
}

/**
 * GET /manage/checktoken/:token - Verify JWT and set auth cookies
 */
export const CheckTokenRoute = {
  method: "get" as const,
  path: "/checktoken/:token",
  request: {
    params: z.object({
      token: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CheckTokenResponseSchema,
        },
      },
      description: "Token validated and cookies set",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Invalid token or server error",
    },
  },
  tags: ["Manage"],
  summary: "Verify JWT and set auth cookies",
  description:
    "Verifies a JWT token from the main application and sets authentication cookies for the billing portal. Enables seamless transitions between applications without re-authentication.",
}
