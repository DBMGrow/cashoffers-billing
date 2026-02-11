import { z } from "zod"
import { ErrorResponseSchema } from "./common.schemas"

/**
 * Email route schemas
 * Handles email template previewing
 */

// ==================== Request Schemas ====================

/**
 * Preview email template request body
 */
export const PreviewEmailRequestSchema = z.object({
  templateName: z.string().min(1, "Template name is required"),
  variables: z.record(z.string(), z.any()).optional(),
})

// ==================== OpenAPI Route Definitions ====================

/**
 * POST /emails/preview - Preview email template
 */
export const PreviewEmailRoute = {
  method: "post" as const,
  path: "/preview",
  request: {
    body: {
      content: {
        "application/json": {
          schema: PreviewEmailRequestSchema,
          example: {
            templateName: "subscriptionRenewal.html",
            variables: {
              amount: "$29.99",
              date: "2026-03-15",
              subscription: "Premium Plan",
            },
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "text/html": {
          schema: z.string(),
        },
      },
      description: "Returns rendered HTML email template",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or template not found",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Emails"],
  summary: "Preview email template",
  description:
    "Render and preview an email template with provided variables. Useful for testing email templates during development.",
}
