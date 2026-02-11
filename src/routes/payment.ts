import { Hono } from "hono"
import type { HonoVariables } from "../../types/hono"
import { authMiddleware } from "../../middleware/hono/authMiddleware"
import userCan from "../../utils/userCan"
import { getContainer } from "@/container"
import { executeUseCase } from "./helpers/use-case-handler"

const app = new Hono<{ Variables: HonoVariables }>()

// Get payments for a user
app.get("/:user_id", authMiddleware("payments_read"), async (c) => {
  const query = c.req.query()
  const { all, page = "1", limit = "20" } = query
  const { user_id } = c.req.param()

  if (!user_id) {
    return c.json({ success: "error", error: "user_id is required" }, 400)
  }

  const mockReq = { user: c.get("user"), token_owner: c.get("token_owner") }
  // @ts-ignore - userCan expects Express request
  const readAll = all && userCan(mockReq, "payments_read_all")

  const container = getContainer()

  return executeUseCase(c, () =>
    container.useCases.getPayments.execute({
      userId: readAll ? undefined : Number(user_id),
      page: Number(page),
      limit: Number(limit),
      readAll: readAll ? true : false,
    })
  )
})

// Create payment
app.post("/", authMiddleware("payments_create"), async (c) => {
  const body = await c.req.json()
  const { user_id, amount, memo, email } = body

  const container = getContainer()
  const paymentContext = c.get('paymentContext')

  return executeUseCase(c, () =>
    container.useCases.createPayment.execute({
      userId: Number(user_id),
      amount: Number(amount),
      email: email || c.get("user")?.email || "",
      memo: memo || "Payment",
      sendEmailOnCharge: true,
      context: paymentContext, // Pass context for environment selection
    })
  )
})

// Refund payment
app.post("/refund", authMiddleware("payments_create"), async (c) => {
  const body = await c.req.json()
  const { user_id, transaction_id, email } = body

  if (!user_id) {
    return c.json({ success: "error", error: "user_id is required" }, 400)
  }
  if (!transaction_id) {
    return c.json({ success: "error", error: "transaction_id is required" }, 400)
  }

  const container = getContainer()
  const paymentContext = c.get('paymentContext')

  return executeUseCase(c, () =>
    container.useCases.refundPayment.execute({
      userId: Number(user_id),
      squareTransactionId: transaction_id,
      email: email || c.get("user")?.email,
      context: paymentContext, // Pass context for environment selection
    })
  )
})

export const paymentRoutes = app
