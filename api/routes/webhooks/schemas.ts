import { z } from "zod"
import { SuccessResponseSchema, ErrorResponseSchema } from "../helpers/common.schemas"

/**
 * CashOffers webhook event body
 */
export const CashOffersWebhookBodySchema = z.object({
  type: z.enum(["user.created", "user.activated", "user.deactivated"]),
  userId: z.number().int().positive(),
})

/**
 * CashOffers webhook response
 */
export const CashOffersWebhookResponseSchema = SuccessResponseSchema(
  z.object({ received: z.boolean() })
)

/**
 * POST /webhooks/cashoffers
 */
export const CashOffersWebhookRoute = {
  method: "post" as const,
  path: "/cashoffers",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CashOffersWebhookBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CashOffersWebhookResponseSchema,
        },
      },
      description: "Webhook received and processed",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Invalid webhook payload",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Invalid webhook signature",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Webhooks"],
  summary: "CashOffers webhook",
  description: "Receives lifecycle events from the CashOffers main API. Requires HMAC-SHA256 signature.",
}
