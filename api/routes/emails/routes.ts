import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import { PreviewEmailRoute } from "./schemas"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

// Email template preview was migrated from MJML to React Email.
// Use `npm run preview:emails` to preview templates via the React Email dev server.
app.openapi(PreviewEmailRoute, async (c) => {
  return c.json(
    {
      error: "Email template preview endpoint is no longer active.",
      message: "Run `npm run preview:emails` to preview email templates via the React Email dev server.",
    },
    400
  )
})

export const emailsRoutes = app
