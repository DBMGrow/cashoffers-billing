import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import { authMiddleware } from "@api/lib/middleware/authMiddleware"
import { getUserCardUseCase, checkUserCardInfoUseCase } from "@api/use-cases/card"
import { createCardUseCase } from "@api/use-cases/payment"
import { executeUseCase } from "../helpers/use-case-handler"
import { GetUserCardRoute, GetUserCardInfoRoute, CreateCardRoute } from "./schemas"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

// Apply auth middleware (no special permissions required)
app.use("*", authMiddleware(null))

// Check if user has a card (more specific route - must come first!)
app.openapi(GetUserCardInfoRoute, async (c) => {
  const { user_id } = c.req.valid("param")

  return executeUseCase(c, () =>
    checkUserCardInfoUseCase.execute({
      userId: Number(user_id),
    })
  )
})

// Get user's card
app.openapi(GetUserCardRoute, async (c) => {
  const { user_id } = c.req.valid("param")

  return executeUseCase(c, () =>
    getUserCardUseCase.execute({
      userId: Number(user_id),
    })
  )
})

// Create new card
app.openapi(CreateCardRoute, async (c) => {
  const body = c.req.valid("json")
  const { user_id, card_token, exp_month, exp_year, cardholder_name } = body

  const user = c.get("user")
  const paymentContext = c.get("paymentContext")

  return executeUseCase(c, () =>
    createCardUseCase.execute({
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
