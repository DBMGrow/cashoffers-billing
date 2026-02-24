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

/**
 * Products response schema
 */
export const ProductsResponseSchema = z.object({
  success: z.literal("success"),
  data: z.array(z.any()),
})

/**
 * Whitelabels response schema
 */
export const WhitelabelsResponseSchema = z.object({
  success: z.literal("success"),
  data: z.array(z.object({
    whitelabel_id: z.number(),
    code: z.string(),
    name: z.string(),
    primary_color: z.string().optional(),
    secondary_color: z.string().optional(),
    logo_url: z.string().optional(),
  })),
})

/**
 * Subscription response schema
 */
export const SubscriptionResponseSchema = z.object({
  success: z.literal("success"),
  data: z.any(),
})

/**
 * Update card request schema
 */
export const UpdateCardRequestSchema = z.object({
  card_token: z.string(),
  exp_month: z.number(),
  exp_year: z.number(),
})

/**
 * Update card response schema
 */
export const UpdateCardResponseSchema = z.object({
  success: z.literal("success"),
  message: z.string().optional(),
})

/**
 * Purchase request schema (for plan changes)
 */
export const ManagePurchaseRequestSchema = z.object({
  product_id: z.union([z.number(), z.string()]),
  subscription_id: z.number().optional(),
})

/**
 * Purchase response schema
 */
export const ManagePurchaseResponseSchema = z.object({
  success: z.literal("success"),
  data: z.object({
    subscription: z.any(),
    charge: z.any().optional(),
  }),
})

/**
 * GET /manage/products - Get products filtered by user role
 */
export const GetProductsRoute = {
  method: "get" as const,
  path: "/products",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ProductsResponseSchema,
        },
      },
      description: "Products retrieved successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request",
    },
  },
  tags: ["Manage"],
  summary: "Get products",
  description:
    "Fetches all active products filtered by user's role and whitelabel. Used in manage flow to show available plan changes.",
}

/**
 * GET /manage/whitelabels - Get all whitelabels
 */
export const GetWhitelabelsRoute = {
  method: "get" as const,
  path: "/whitelabels",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: WhitelabelsResponseSchema,
        },
      },
      description: "Whitelabels retrieved successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request",
    },
  },
  tags: ["Manage"],
  summary: "Get whitelabels",
  description:
    "Fetches all whitelabel branding data including colors and logos. Used to dynamically theme the application.",
}

/**
 * GET /manage/subscription/single - Get user's current subscription
 */
export const GetSubscriptionRoute = {
  method: "get" as const,
  path: "/subscription/single",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SubscriptionResponseSchema,
        },
      },
      description: "Subscription retrieved successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Subscription not found",
    },
  },
  tags: ["Manage"],
  summary: "Get user's current subscription",
  description:
    "Fetches the authenticated user's active subscription with product details.",
}

/**
 * POST /manage/updatecard - Update card on file
 */
export const UpdateCardRoute = {
  method: "post" as const,
  path: "/updatecard",
  request: {
    body: {
      content: {
        "application/json": {
          schema: UpdateCardRequestSchema,
          example: {
            card_token: "cnon:card-nonce-ok",
            exp_month: 12,
            exp_year: 2025,
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: UpdateCardResponseSchema,
        },
      },
      description: "Card updated successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or card update failed",
    },
  },
  tags: ["Manage"],
  summary: "Update card on file",
  description:
    "Updates the user's payment card on file. Used when users want to change their billing card.",
}

/**
 * POST /manage/purchase - Change subscription plan
 */
export const ManagePurchaseRoute = {
  method: "post" as const,
  path: "/purchase",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ManagePurchaseRequestSchema,
          example: {
            product_id: 2,
            subscription_id: 123,
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ManagePurchaseResponseSchema,
        },
      },
      description: "Plan changed successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or plan change failed",
    },
  },
  tags: ["Manage"],
  summary: "Change subscription plan",
  description:
    "Changes the user's subscription to a different plan. Handles prorated charges and role validation.",
}
