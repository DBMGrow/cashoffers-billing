import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@/types/hono"
import { parseEmailTemplate } from "@/infrastructure/email/sendgrid/template-parser"
import { PreviewEmailRoute } from "./schemas/emails.schemas"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

// Preview email template
app.openapi(PreviewEmailRoute, async (c) => {
  const body = c.req.valid("json")
  const html = await parseEmailTemplate(body.templateName, body.variables || {})

  return c.html(html)
})

export const emailsRoutes = app
