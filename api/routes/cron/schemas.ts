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

/**
 * Resend skipped subscription receipts request body
 */
export const ResendReceiptsRequestSchema = z.object({
  secret: z.string().min(1, "Secret is required"),
  apply: z.boolean().optional().describe("Send the receipts. Omitted or false is a dry run that sends nothing."),
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

/**
 * Resend skipped subscription receipts response
 */
export const ResendReceiptsResponseSchema = z.object({
  success: z.literal("success"),
  apply: z.boolean(),
  sent: z.array(
    z.object({ subscriptionId: z.number(), userId: z.number(), subject: z.string(), chargedAt: z.string() })
  ),
  sandbox: z.array(z.number()),
  needsReview: z.array(z.object({ subscriptionId: z.number(), reason: z.string() })),
  alreadyResent: z.number(),
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

/**
 * POST /cron/resend-subscription-receipts - Resend receipts skipped as "provisioning failed"
 */
export const ResendReceiptsRoute = {
  method: "post" as const,
  path: "/resend-subscription-receipts",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ResendReceiptsRequestSchema,
          example: { secret: "your-cron-secret", apply: false },
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: ResendReceiptsResponseSchema } },
      description: "What was sent, or would be sent on a dry run",
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
  summary: "Resend skipped subscription receipts",
  description:
    "Resends the subscription-created receipt to existing-user purchases that skipped it as 'provisioning failed' (desk-1727). Dry run unless apply is true; stamps each sent receipt so a re-run never sends twice. Requires valid CRON_SECRET.",
}
