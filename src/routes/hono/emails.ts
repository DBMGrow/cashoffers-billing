import { Hono } from "hono"
import type { HonoVariables } from "../../types/hono"
import parseEmailTemplate from "@/utils/parseEmailTemplate"

const app = new Hono<{ Variables: HonoVariables }>()

// Preview email template
app.post("/preview", async (c) => {
  const body = await c.req.json()
  const html = await parseEmailTemplate(body.templateName, body.variables)

  return c.html(html || "")
})

export const emailsRoutes = app
