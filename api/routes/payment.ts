import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@/types/hono"
import { authMiddleware } from "@/middleware/authMiddleware"
import { userCan } from "@/utils/userCan"
import { getContainer } from "@/container"
import { executeUseCase } from "./helpers/use-case-handler"
import {
  GetPaymentsRoute,
  CreatePaymentRoute,
  RefundPaymentRoute,
} from "./schemas/payment.schemas"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

// Apply auth middleware
app.use("/:user_id", authMiddleware("payments_read"))
app.use("/", authMiddleware("payments_create"))
app.use("/refund", authMiddleware("payments_create"))

// Get payments for a user
app.openapi(GetPaymentsRoute, async (c) => {
  const { user_id } = c.req.valid("param")
  const query = c.req.valid("query")
  const { all, page = 1, limit = 20 } = query

  const tokenOwner = c.get("token_owner")
  const readAll = all && userCan(tokenOwner, "payments_read_all")

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
app.openapi(CreatePaymentRoute, async (c) => {
  const body = c.req.valid("json")

  const container = getContainer()
  const paymentContext = c.get("paymentContext")

  return executeUseCase(c, () =>
    container.useCases.createPayment.execute({
      userId: Number(body.user_id),
      amount: Number(body.amount),
      email: body.email || c.get("user")?.email || "",
      memo: body.memo || "Payment",
      sendEmailOnCharge: true,
      context: paymentContext, // Pass context for environment selection
    })
  )
})

// Refund payment
app.openapi(RefundPaymentRoute, async (c) => {
  const body = c.req.valid("json")

  const container = getContainer()
  const paymentContext = c.get("paymentContext")

  return executeUseCase(c, () =>
    container.useCases.refundPayment.execute({
      userId: Number(body.user_id),
      squareTransactionId: body.transaction_id,
      email: body.email || c.get("user")?.email,
      context: paymentContext, // Pass context for environment selection
    })
  )
})

export const paymentRoutes = app
