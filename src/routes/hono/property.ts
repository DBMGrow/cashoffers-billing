import { Hono } from "hono"
import type { HonoVariables } from "../../types/hono"
import { authMiddleware } from "../../middleware/hono/authMiddleware"
import { getContainer } from "@/container"
import { executeUseCase } from "./helpers/use-case-handler"

const app = new Hono<{ Variables: HonoVariables }>()

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
app.post(
  "/:property_token",
  authMiddleware("properties_unlock", { allowSelf: true }),
  async (c) => {
    const { property_token } = c.req.param()
    const body = await c.req.json()
    const user = c.get("user")
    const container = getContainer()

    return executeUseCase(c, () =>
      container.useCases.unlockProperty.execute({
        propertyToken: property_token,
        cardToken: body.card_token,
        userId: user?.user_id,
        email: user?.email || "",
      })
    )
  }
)

export const propertyRoutes = app
