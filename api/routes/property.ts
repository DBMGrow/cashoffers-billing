import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import { authMiddleware } from "@/api/lib/middleware/authMiddleware"
import { getContainer } from "@api/container"
import { executeUseCase } from "./helpers/use-case-handler"
import { UnlockPropertyRoute } from "./schemas/property.schemas"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

// Apply auth middleware
app.use("/:property_token", authMiddleware("properties_unlock"))

/**
 * Unlock a property
 * POST /property/:property_token
 *
 * Requires:
 * - property_token: Property identifier from main API
 * - card_token: Ephemeral token from Square
 *
 * Returns:
 * - Property address
 * - Transaction ID
 * - Square payment ID
 * - Amount charged ($50)
 * - Unlock status
 */
app.openapi(UnlockPropertyRoute, async (c) => {
  const { property_token } = c.req.valid("param")
  const body = c.req.valid("json")
  const user = c.get("user")
  const container = getContainer()
  const paymentContext = c.get("paymentContext")

  return executeUseCase(c, () =>
    container.useCases.unlockProperty.execute({
      propertyToken: property_token,
      cardToken: body.card_token,
      userId: user?.user_id,
      email: user?.email || "",
      context: paymentContext, // Pass context for environment selection
    })
  )
})

export const propertyRoutes = app
