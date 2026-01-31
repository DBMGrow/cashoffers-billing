import { Hono } from "hono"
import type { HonoVariables } from "../../types/hono"
import { authMiddleware } from "../../middleware/hono/authMiddleware"
import { UserCard } from "../../database/UserCard"
import createCard from "../../utils/createCard"
import handleErrors from "../../utils/handleErrors"

const app = new Hono<{ Variables: HonoVariables }>()

// Get user's card
app.get("/:user_id", authMiddleware(null), async (c) => {
  const user_id = c.req.param("user_id")

  try {
    if (!user_id) throw new Error("user_id is required")

    const userCard = await UserCard.findOne({ where: { user_id } })
    if (!userCard) throw new Error("No card found")

    return c.json({ success: "success", data: userCard })
  } catch (error: any) {
    return c.json({ success: "error", error: error.message })
  }
})

// Check if user has a card
app.get("/:user_id/info", authMiddleware(null), async (c) => {
  const user_id = c.req.param("user_id")

  try {
    if (!user_id) throw new Error("0001C: user_id is required")

    const userCard = await UserCard.findOne({ where: { user_id } })
    if (!userCard) {
      return c.json({ success: "success", data: { has_card: false } })
    }

    return c.json({ success: "success", data: { has_card: true, ...(userCard as any).toJSON() } })
  } catch (error: any) {
    return c.json({ success: "error", error: error.message })
  }
})

// Create new card
app.post("/", authMiddleware(null), async (c) => {
  const body = await c.req.json()
  const { user_id, card_token, exp_month, exp_year, cardholder_name } = body

  try {
    const user = c.get("user")
    const response = await createCard(
      user_id,
      card_token,
      exp_month,
      exp_year,
      cardholder_name,
      user?.email,
      {
        allowNullUserId: false,
      }
    )

    return c.json({ success: "success", data: response?.data })
  } catch (error: any) {
    // Create mock req/res for handleErrors compatibility
    const mockReq = { body, user: c.get("user") }
    const mockRes = {
      json: (data: any) => c.json(data),
      status: (code: number) => ({ json: (data: any) => c.json(data, code as any) }),
    }
    return handleErrors(mockReq as any, mockRes as any, error)
  }
})

export const cardRoutes = app
