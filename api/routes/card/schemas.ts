import { z } from "zod"
import {
  SuccessResponseSchema,
  ErrorResponseSchema,
  UserIdParamSchema,
  PositiveIntSchema,
  EmailSchema,
} from "../helpers/common.schemas"

/**
 * Card route schemas
 * Handles card management - create, retrieve, and check card info
 */

// ==================== Request Schemas ====================

/**
 * Create card request body
 */
export const CreateCardRequestSchema = z.object({
  user_id: PositiveIntSchema.nullable().optional(),
  card_token: z.string().min(1, "Card token is required"),
  exp_month: z.coerce.number().int().min(1).max(12, "Month must be between 1 and 12"),
  exp_year: z.coerce.number().int().min(2020, "Year must be valid"),
  cardholder_name: z.string().min(1, "Cardholder name is required"),
})

// ==================== Response Schemas ====================

/**
 * User card details - matches GetUserCardOutput
 */
export const UserCardResponseSchema = SuccessResponseSchema(
  z.object({
    id: z.number(),
    userId: z.number().nullable(),
    cardId: z.string(),
    last4: z.string(),
    cardBrand: z.string(),
    expMonth: z.string(),
    expYear: z.string(),
    cardholderName: z.string().nullable(),
    squareCustomerId: z.string().nullable(),
    createdAt: z.union([z.string(), z.date()]),
  })
)

/**
 * Card info response (lightweight - just check if card exists)
 * Matches CheckUserCardInfoOutput with CardData (snake_case fields from database)
 */
export const CardInfoResponseSchema = SuccessResponseSchema(
  z.object({
    hasCard: z.boolean(),
    card: z
      .object({
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
      .optional(),
  })
)

/**
 * Create card response - matches CreateCardOutput
 */
export const CreateCardResponseSchema = SuccessResponseSchema(
  z.object({
    cardId: z.string(),
    squareCustomerId: z.string(),
    last4: z.string(),
    cardBrand: z.string(),
    expMonth: z.number(),
    expYear: z.number(),
  })
)

// ==================== OpenAPI Route Definitions ====================

/**
 * GET /card/:user_id - Get user's card details
 */
export const GetUserCardRoute = {
  method: "get" as const,
  path: "/{user_id}",
  request: {
    params: UserIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: UserCardResponseSchema,
        },
      },
      description: "Returns user's card details",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or card not found",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Cards"],
  summary: "Get user card details",
  description: "Retrieve stored card details for a user. No special permissions required.",
}

/**
 * GET /card/:user_id/info - Check if user has a card
 */
export const GetUserCardInfoRoute = {
  method: "get" as const,
  path: "/{user_id}/info",
  request: {
    params: UserIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CardInfoResponseSchema,
        },
      },
      description: "Returns whether user has a card on file",
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
  tags: ["Cards"],
  summary: "Check if user has card",
  description:
    "Check if a user has a payment card on file. Returns basic card info if exists. No special permissions required.",
}

/**
 * POST /card - Create/update user's card
 */
export const CreateCardRoute = {
  method: "post" as const,
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateCardRequestSchema,
          example: {
            user_id: 123,
            card_token: "tok_visa_4242",
            exp_month: 12,
            exp_year: 2025,
            cardholder_name: "John Doe",
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CreateCardResponseSchema,
        },
      },
      description: "Card created/updated successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or card creation failed",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Cards"],
  summary: "Create or update card",
  description:
    "Store or update a payment card for a user. Card token should be obtained from Square. Will attempt to renew any paused subscriptions. No special permissions required.",
}
