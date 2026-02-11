import { z } from "zod"
import {
  SuccessResponseSchema,
  ErrorResponseSchema,
  UserIdParamSchema,
  PaginationQuerySchema,
  PositiveIntSchema,
  EmailSchema,
  AmountSchema,
  TransactionStatusSchema,
  TransactionTypeSchema,
  SquareEnvironmentSchema,
} from "./common.schemas"

/**
 * Payment route schemas
 * Handles one-time payments, transactions history, and refunds
 */

// ==================== Request Schemas ====================

/**
 * Create payment request body
 */
export const CreatePaymentRequestSchema = z.object({
  user_id: PositiveIntSchema,
  amount: AmountSchema,
  email: EmailSchema.optional(),
  memo: z.string().optional(),
})

/**
 * Refund payment request body
 */
export const RefundPaymentRequestSchema = z.object({
  user_id: PositiveIntSchema,
  transaction_id: z.string().min(1, "Transaction ID is required"),
  email: EmailSchema.optional(),
})

/**
 * Get payments query parameters
 * Extends pagination with 'all' flag for admin queries
 */
export const GetPaymentsQuerySchema = PaginationQuerySchema.extend({
  all: z.string().optional(), // Query params are always strings
})

// ==================== Response Schemas ====================

/**
 * Transaction object (individual payment record)
 */
export const TransactionSchema = z.object({
  transaction_id: z.number(),
  user_id: z.number(),
  amount: z.number(),
  type: TransactionTypeSchema,
  memo: z.string().nullable(),
  status: TransactionStatusSchema,
  square_transaction_id: z.string().nullable(),
  square_environment: SquareEnvironmentSchema.nullable(),
  createdAt: z.string(), // ISO date string
  updatedAt: z.string(),
})

/**
 * Create payment response
 */
export const CreatePaymentResponseSchema = SuccessResponseSchema(
  z.object({
    transactionId: z.string(),
    squarePaymentId: z.string(),
    amount: z.number(),
    status: z.string(),
  })
)

/**
 * Get payments response with pagination
 * Matches GetPaymentsOutput from use case
 */
export const GetPaymentsResponseSchema = SuccessResponseSchema(
  z.object({
    payments: z.array(
      z.object({
        id: z.number(),
        userId: z.number(),
        amount: z.number(),
        type: z.string(),
        memo: z.string(),
        status: z.string(),
        createdAt: z.union([z.string(), z.date()]), // Can be Date or string
        squareTransactionId: z.string().optional(),
      })
    ),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  })
)

/**
 * Refund payment response
 */
export const RefundPaymentResponseSchema = SuccessResponseSchema(
  z.object({
    refundId: z.string(),
    amount: z.number(),
    status: z.string(),
    originalTransactionId: z.string(),
  })
)

// ==================== OpenAPI Route Definitions ====================

/**
 * GET /payment/:user_id - Get user payments
 */
export const GetPaymentsRoute = {
  method: "get" as const,
  path: "/{user_id}",
  request: {
    params: UserIdParamSchema,
    query: GetPaymentsQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: GetPaymentsResponseSchema,
        },
      },
      description: "Returns paginated list of user payments",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Bad request or business logic error",
    },
    500: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Internal server error",
    },
  },
  tags: ["Payments"],
  summary: "Get user payments",
  description:
    "Retrieve paginated list of payments/transactions for a specific user. Requires payments_read permission. Users with payments_read_all permission can view all transactions using the 'all' query parameter.",
}

/**
 * POST /payment - Create one-time payment
 */
export const CreatePaymentRoute = {
  method: "post" as const,
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreatePaymentRequestSchema,
          example: {
            user_id: 123,
            amount: 25000, // $250.00 in cents
            email: "user@example.com",
            memo: "One-time payment",
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CreatePaymentResponseSchema,
        },
      },
      description: "Payment processed successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Bad request or payment processing failed",
    },
    500: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Internal server error",
    },
  },
  tags: ["Payments"],
  summary: "Create one-time payment",
  description:
    "Process a one-time payment for a user using their stored card. Amount is in cents. Sends email notification upon successful charge. Requires payments_create permission.",
}

/**
 * POST /payment/refund - Refund a payment
 */
export const RefundPaymentRoute = {
  method: "post" as const,
  path: "/refund",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RefundPaymentRequestSchema,
          example: {
            user_id: 123,
            transaction_id: "sq_12345",
            email: "user@example.com",
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: RefundPaymentResponseSchema,
        },
      },
      description: "Refund processed successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Bad request or refund failed",
    },
    500: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Internal server error",
    },
  },
  tags: ["Payments"],
  summary: "Refund payment",
  description:
    "Refund a previously completed payment. Transaction ID is the Square transaction ID. Sends email notification upon successful refund. Requires payments_create permission.",
}
