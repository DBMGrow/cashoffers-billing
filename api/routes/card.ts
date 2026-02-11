import { Hono } from "hono"
import type { HonoVariables } from "@/types/hono"
import { authMiddleware } from "@/middleware/authMiddleware"
import { getContainer } from "@/container"
import { executeUseCase } from "./helpers/use-case-handler"

const app = new Hono<{ Variables: HonoVariables }>()

// Get user's card
app.get("/:user_id", authMiddleware(null), async (c) => {
  const user_id = c.req.param("user_id")

  if (!user_id) {
    return c.json({ success: "error", error: "user_id is required" }, 400)
  }

  const container = getContainer()

  return executeUseCase(c, () =>
    container.useCases.getUserCard.execute({
      userId: Number(user_id),
    })
  )
})

// Check if user has a card
app.get("/:user_id/info", authMiddleware(null), async (c) => {
  const user_id = c.req.param("user_id")

  if (!user_id) {
    return c.json({ success: "error", error: "user_id is required" }, 400)
  }

  const container = getContainer()

  return executeUseCase(c, () =>
    container.useCases.checkUserCardInfo.execute({
      userId: Number(user_id),
    })
  )
})

// Create new card
app.post("/", authMiddleware(null), async (c) => {
  const body = await c.req.json()
  const { user_id, card_token, exp_month, exp_year, cardholder_name } = body

  const user = c.get("user")
  const container = getContainer()
  const paymentContext = c.get('paymentContext')

  return executeUseCase(c, () =>
    container.useCases.createCard.execute({
      userId: user_id ? Number(user_id) : null,
      cardToken: card_token,
      expMonth: Number(exp_month),
      expYear: Number(exp_year),
      cardholderName: cardholder_name,
      email: user?.email || "",
      sendEmailOnUpdate: true,
      attemptRenewal: true,
      context: paymentContext, // Pass context for environment selection
    })
  )
})

export const cardRoutes = app
