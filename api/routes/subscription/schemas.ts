import { z } from "zod"
import {
  SuccessResponseSchema,
  ErrorResponseSchema,
  SubscriptionIdParamSchema,
  PaginationQuerySchema,
  PositiveIntSchema,
  EmailSchema,
  AmountSchema,
} from "../helpers/common.schemas"

/**
 * Subscription route schemas
 * Handles subscription CRUD, pause/resume, and cancel/downgrade operations
 */

// ==================== Enums ====================

export const DurationSchema = z.enum(["daily", "weekly", "monthly", "yearly"])
export const SubscriptionStatusSchema = z.enum(["active", "paused", "cancelled", "expired"])

// ==================== Request Schemas ====================

/**
 * Create/update subscription request body (POST /)
 */
export const CreateOrUpdateSubscriptionRequestSchema = z.object({
  user_id: PositiveIntSchema,
  subscription_name: z.string().optional(),
  amount: z.coerce.number().int().positive().optional(),
  duration: DurationSchema.optional(),
  product_id: z.union([z.string(), z.number()]).optional(),
  signup_fee: z.coerce.number().int().min(0).optional(),
  email: EmailSchema.optional(),
})

/**
 * Update subscription request body (PUT /)
 */
export const UpdateSubscriptionRequestSchema = z.object({
  subscription_id: PositiveIntSchema,
  subscription_name: z.string().optional(),
  amount: z.coerce.number().int().positive().optional(),
  duration: DurationSchema.optional(),
  status: z.string().optional(),
})

/**
 * Delete subscription request body (DELETE /)
 */
export const DeleteSubscriptionRequestSchema = z.object({
  user_id: PositiveIntSchema,
})

/**
 * Get subscriptions query parameters (GET /)
 */
export const GetSubscriptionsQuerySchema = PaginationQuerySchema

// ==================== Response Schemas ====================

/**
 * Subscription object
 */
export const SubscriptionSchema = z.object({
  subscriptionId: z.number(),
  userId: z.number().nullable(),
  subscriptionName: z.string(),
  amount: z.number(),
  duration: z.string(),
  status: z.string(),
  renewalDate: z.union([z.string(), z.date(), z.null()]),
  cancelOnRenewal: z.boolean(),
  downgradeOnRenewal: z.boolean(),
  createdAt: z.union([z.string(), z.date()]),
})

/**
 * Get subscriptions response
 */
export const GetSubscriptionsResponseSchema = SuccessResponseSchema(
  z.object({
    subscriptions: z.array(SubscriptionSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  })
)

/**
 * Create subscription response
 */
export const CreateSubscriptionResponseSchema = SuccessResponseSchema(
  z.object({
    subscriptionId: z.number(),
    status: z.string(),
    renewalDate: z.union([z.string(), z.date()]),
    amount: z.number(),
  })
)

/**
 * Update subscription response
 */
export const UpdateSubscriptionResponseSchema = SuccessResponseSchema(
  z.object({
    subscriptionId: z.number(),
    updated: z.boolean(),
  })
)

/**
 * Delete subscription response
 */
export const DeleteSubscriptionResponseSchema = SuccessResponseSchema(
  z.object({
    userId: z.number(),
    status: z.string(),
  })
)

/**
 * Pause subscription response
 */
export const PauseSubscriptionResponseSchema = SuccessResponseSchema(
  z.object({
    subscriptionId: z.number(),
    status: z.string(),
  })
)

/**
 * Resume subscription response
 */
export const ResumeSubscriptionResponseSchema = SuccessResponseSchema(
  z.object({
    subscriptionId: z.number(),
    status: z.string(),
  })
)

/**
 * Cancel/Downgrade flag response
 */
export const SubscriptionFlagResponseSchema = SuccessResponseSchema(
  z.object({
    subscriptionId: z.number(),
    updated: z.boolean(),
  })
)

// ==================== OpenAPI Route Definitions ====================

/**
 * GET /subscription - Get all subscriptions (admin)
 */
export const GetAllSubscriptionsRoute = {
  method: "get" as const,
  path: "/",
  request: {
    query: GetSubscriptionsQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: GetSubscriptionsResponseSchema,
        },
      },
      description: "Returns paginated list of all subscriptions",
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
  tags: ["Subscriptions"],
  summary: "Get all subscriptions",
  description: "Retrieve paginated list of all subscriptions. Requires payments_read_all permission (admin only).",
}

/**
 * GET /subscription/single - Get own subscription
 */
export const GetOwnSubscriptionRoute = {
  method: "get" as const,
  path: "/single",
  request: {},
  responses: {
    200: {
      content: {
        "application/json": {
          schema: GetSubscriptionsResponseSchema,
        },
      },
      description: "Returns authenticated user's subscription",
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
  tags: ["Subscriptions"],
  summary: "Get own subscription",
  description: "Retrieve the authenticated user's subscription. Any authenticated user can access this.",
}

/**
 * POST /subscription - Create or update subscription
 */
export const CreateOrUpdateSubscriptionRoute = {
  method: "post" as const,
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateOrUpdateSubscriptionRequestSchema,
          example: {
            user_id: 123,
            subscription_name: "Premium",
            amount: 25000,
            duration: "monthly",
            product_id: 1,
            signup_fee: 0,
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.union([CreateSubscriptionResponseSchema, UpdateSubscriptionResponseSchema]),
        },
      },
      description: "Subscription created or updated successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or business logic error",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Subscriptions"],
  summary: "Create or update subscription",
  description:
    "Create a new subscription or update existing one. If user already has a subscription, it will be updated. Requires payments_create permission.",
}

/**
 * PUT /subscription - Update subscription
 */
export const UpdateSubscriptionRoute = {
  method: "put" as const,
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: UpdateSubscriptionRequestSchema,
          example: {
            subscription_id: 456,
            subscription_name: "Premium Plus",
            amount: 35000,
            duration: "monthly",
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: UpdateSubscriptionResponseSchema,
        },
      },
      description: "Subscription updated successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or subscription not found",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Subscriptions"],
  summary: "Update subscription",
  description: "Update an existing subscription's fields. Requires payments_create permission.",
}

/**
 * DELETE /subscription - Delete/deactivate subscription
 */
export const DeleteSubscriptionRoute = {
  method: "delete" as const,
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: DeleteSubscriptionRequestSchema,
          example: {
            user_id: 123,
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DeleteSubscriptionResponseSchema,
        },
      },
      description: "Subscription deactivated successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or subscription not found",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Subscriptions"],
  summary: "Delete subscription",
  description: "Deactivate a user's subscription. Requires payments_delete permission.",
}

/**
 * POST /subscription/pause/:subscription_id - Pause subscription
 */
export const PauseSubscriptionRoute = {
  method: "post" as const,
  path: "/pause/{subscription_id}",
  request: {
    params: SubscriptionIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PauseSubscriptionResponseSchema,
        },
      },
      description: "Subscription paused successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or subscription not found",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Subscriptions"],
  summary: "Pause subscription",
  description: "Pause a subscription - no charges will be processed while paused. Requires payments_create permission.",
}

/**
 * POST /subscription/resume/:subscription_id - Resume subscription
 */
export const ResumeSubscriptionRoute = {
  method: "post" as const,
  path: "/resume/{subscription_id}",
  request: {
    params: SubscriptionIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ResumeSubscriptionResponseSchema,
        },
      },
      description: "Subscription resumed successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or subscription not found",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Subscriptions"],
  summary: "Resume subscription",
  description:
    "Resume a paused subscription - charges will resume on next renewal date. Requires payments_create permission.",
}

/**
 * POST /subscription/cancel/:subscription_id - Cancel subscription on renewal
 */
export const CancelSubscriptionRoute = {
  method: "post" as const,
  path: "/cancel/{subscription_id}",
  request: {
    params: SubscriptionIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SubscriptionFlagResponseSchema,
        },
      },
      description: "Subscription marked for cancellation on next renewal",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or subscription not found",
    },
    403: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Forbidden - not authorized to cancel this subscription",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Subscriptions"],
  summary: "Cancel subscription on renewal",
  description:
    "Mark subscription for cancellation at the end of current billing period. Users can cancel their own subscriptions, or admins can cancel any subscription.",
}

/**
 * POST /subscription/uncancel/:subscription_id - Uncancel subscription
 */
export const UncancelSubscriptionRoute = {
  method: "post" as const,
  path: "/uncancel/{subscription_id}",
  request: {
    params: SubscriptionIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SubscriptionFlagResponseSchema,
        },
      },
      description: "Subscription cancellation removed - will continue renewing",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or subscription not found",
    },
    403: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Forbidden - not authorized to modify this subscription",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Subscriptions"],
  summary: "Uncancel subscription",
  description:
    "Remove cancellation flag from subscription - it will continue to renew. Users can uncancel their own subscriptions.",
}

/**
 * POST /subscription/downgrade/:subscription_id - Mark for downgrade on renewal
 */
export const DowngradeSubscriptionRoute = {
  method: "post" as const,
  path: "/downgrade/{subscription_id}",
  request: {
    params: SubscriptionIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SubscriptionFlagResponseSchema,
        },
      },
      description: "Subscription marked for downgrade on next renewal",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or subscription not found",
    },
    403: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Forbidden - not authorized to modify this subscription",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Subscriptions"],
  summary: "Mark subscription for downgrade",
  description:
    "Mark subscription to be downgraded at end of current billing period. Users can downgrade their own subscriptions.",
}

/**
 * POST /subscription/retry-renewal/:subscription_id - Admin: immediately retry renewal
 */
export const RetryRenewalRoute = {
  method: "post" as const,
  path: "/retry-renewal/{subscription_id}",
  request: {
    params: SubscriptionIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SuccessResponseSchema(
            z.object({ subscriptionId: z.number(), success: z.boolean() })
          ),
        },
      },
      description: "Renewal retried",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or subscription not found",
    },
    403: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Forbidden - admin only",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Subscriptions"],
  summary: "Retry renewal (admin)",
  description: "Immediately retry renewal for a subscription. Requires payments_create permission (admin).",
}

/**
 * POST /subscription/undowngrade/:subscription_id - Remove downgrade flag
 */
export const UndowngradeSubscriptionRoute = {
  method: "post" as const,
  path: "/undowngrade/{subscription_id}",
  request: {
    params: SubscriptionIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SubscriptionFlagResponseSchema,
        },
      },
      description: "Downgrade flag removed - subscription will continue at current level",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or subscription not found",
    },
    403: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Forbidden - not authorized to modify this subscription",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Subscriptions"],
  summary: "Remove downgrade flag",
  description:
    "Remove downgrade flag from subscription - it will continue at current level. Users can remove downgrade from their own subscriptions.",
}
