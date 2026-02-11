import { z } from "zod"
import {
  SuccessResponseSchema,
  ErrorResponseSchema,
  PropertyTokenParamSchema,
  AmountSchema,
} from "./common.schemas"

/**
 * Property route schemas
 * Handles property unlock payments
 */

// ==================== Request Schemas ====================

/**
 * Unlock property request body
 */
export const UnlockPropertyRequestSchema = z.object({
  card_token: z.string().min(1, "Card token is required"),
})

// ==================== Response Schemas ====================

/**
 * Unlock property response
 */
export const UnlockPropertyResponseSchema = SuccessResponseSchema(
  z.object({
    propertyAddress: z.string(),
    transactionId: z.string(),
    squarePaymentId: z.string(),
    amount: z.number(),
    unlocked: z.boolean(),
  })
)

// ==================== OpenAPI Route Definitions ====================

/**
 * POST /property/:property_token - Unlock property
 */
export const UnlockPropertyRoute = {
  method: "post" as const,
  path: "/{property_token}",
  request: {
    params: PropertyTokenParamSchema,
    body: {
      content: {
        "application/json": {
          schema: UnlockPropertyRequestSchema,
          example: {
            card_token: "cnon:card-nonce-ok",
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: UnlockPropertyResponseSchema,
        },
      },
      description: "Property unlocked successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or unlock failed",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Property"],
  summary: "Unlock property",
  description:
    "Unlock a property by charging $50 to the provided card. Requires properties_unlock permission.",
}
