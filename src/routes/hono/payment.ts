import { Hono } from "hono"
import type { HonoVariables } from "../../types/hono"
import { authMiddleware } from "../../middleware/hono/authMiddleware"
import userCan from "../../utils/userCan"
import { getContainer } from "@/container"

const app = new Hono<{ Variables: HonoVariables }>()

// Get payments for a user
app.get("/:user_id", authMiddleware("payments_read"), async (c) => {
  const query = c.req.query()
  const { all, page = "1", limit = "20" } = query

  const { user_id } = c.req.param()
  if (!user_id) throw new Error("user_id is required")

  // Create mock request for userCan compatibility
  const mockReq = { user: c.get("user"), token_owner: c.get("token_owner") }

  // Check if user has read_all permission
  // @ts-ignore
  const readAll = all && userCan(mockReq, "payments_read_all")

  // Get use case from container
  const container = getContainer()
  const getPaymentsUseCase = container.useCases.getPayments

  // Execute use case
  const result = await getPaymentsUseCase.execute({
    userId: readAll ? undefined : Number(user_id),
    page: Number(page),
    limit: Number(limit),
    readAll: readAll ? true : false,
  })

  if (!result.success) {
    return c.json({
      success: "error",
      error: result.error,
      code: result.code
    }, 400)
  }

  return c.json({
    success: "success",
    data: result.data.payments,
    page: result.data.page,
    limit: result.data.limit,
    total: result.data.total,
  })
})

// Create payment
app.post("/", authMiddleware("payments_create"), async (c) => {
  const body = await c.req.json()
  const { user_id, amount, memo, email } = body

  try {
    // Get use case from container
    const container = getContainer()
    const createPaymentUseCase = container.useCases.createPayment

    // Execute use case
    const result = await createPaymentUseCase.execute({
      userId: Number(user_id),
      amount: Number(amount),
      email: email || c.get("user")?.email || '',
      memo: memo || 'Payment',
      sendEmailOnCharge: true,
    })

    if (!result.success) {
      return c.json({
        success: "error",
        error: result.error,
        code: result.code
      }, 400)
    }

    return c.json({
      success: "success",
      data: result.data
    })
  } catch (error: any) {
    return c.json({
      success: "error",
      error: error.message || 'Payment failed'
    }, 500)
  }
})

// Refund payment
app.post("/refund", authMiddleware("payments_create"), async (c) => {
  const body = await c.req.json()
  const { user_id, transaction_id, email } = body

  try {
    if (!user_id) throw new Error("user_id is required")
    if (!transaction_id) throw new Error("transaction_id is required")

    // Get use case from container
    const container = getContainer()
    const refundPaymentUseCase = container.useCases.refundPayment

    // Execute use case
    const result = await refundPaymentUseCase.execute({
      userId: Number(user_id),
      squareTransactionId: transaction_id,
      email: email || c.get("user")?.email,
    })

    if (!result.success) {
      return c.json({
        success: "error",
        error: result.error,
        code: result.code
      }, 400)
    }

    return c.json({
      success: "success",
      data: result.data
    })
  } catch (error: any) {
    return c.json({
      success: "error",
      error: error.message || 'Refund failed'
    }, 500)
  }
})

export const paymentRoutes = app
