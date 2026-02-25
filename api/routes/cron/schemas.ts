import { z } from "zod"
import { SuccessResponseSchema, ErrorResponseSchema } from "../helpers/common.schemas"

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

/**
 * Send daily health report request body
 */
export const SendHealthReportRequestSchema = z.object({
  secret: z.string().min(1, "Secret is required"),
  date: z.string().optional().describe("Optional date for the report (ISO 8601 format)"),
})

// ==================== Response Schemas ====================

/**
 * Run cron jobs response
 */
export const RunCronResponseSchema = z.object({
  success: z.literal("success"),
  message: z.string(),
})

/**
 * Send health report response
 */
export const SendHealthReportResponseSchema = z.object({
  success: z.literal("success"),
  message: z.string(),
  reportDate: z.string(),
  recipientCount: z.number(),
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

/**
 * POST /cron/health-report - Send daily health report
 */
export const SendHealthReportRoute = {
  method: "post" as const,
  path: "/health-report",
  request: {
    body: {
      content: {
        "application/json": {
          schema: SendHealthReportRequestSchema,
          example: {
            secret: "your-cron-secret",
            date: "2024-03-15",
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SendHealthReportResponseSchema,
        },
      },
      description: "Health report sent successfully",
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
  summary: "Send daily health report",
  description:
    "Generate and send a daily health report with system metrics to configured administrators. Requires valid CRON_SECRET for authentication. Should be scheduled to run once daily.",
}
