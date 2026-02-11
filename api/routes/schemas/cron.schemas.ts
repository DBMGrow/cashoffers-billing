import { z } from "zod"
import { SuccessResponseSchema, ErrorResponseSchema } from "./common.schemas"

/**
 * Cron route schemas
 * Handles scheduled task triggers (subscription renewals, etc.)
 */

// ==================== Request Schemas ====================

/**
 * Run cron jobs request body
 */
export const RunCronRequestSchema = z.object({
  secret: z.string().min(1, "Secret is required"),
})

// ==================== Response Schemas ====================

/**
 * Run cron jobs response
 */
export const RunCronResponseSchema = z.object({
  success: z.literal("success"),
  message: z.string(),
})

// ==================== OpenAPI Route Definitions ====================

/**
 * POST /cron - Run cron jobs
 */
export const RunCronRoute = {
  method: "post" as const,
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RunCronRequestSchema,
          example: {
            secret: "your-cron-secret",
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: RunCronResponseSchema,
        },
      },
      description: "Cron jobs triggered successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or unauthorized",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Cron"],
  summary: "Run cron jobs",
  description:
    "Trigger subscription renewals and other scheduled tasks. Requires valid CRON_SECRET for authentication. Typically called by external cron service.",
}
