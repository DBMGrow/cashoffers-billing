import { Hono } from "hono"
import type { HonoVariables } from "../../types/hono"
import { authMiddleware } from "../../middleware/hono/authMiddleware"
import createPayment from "../../utils/createPayment"
import { Transaction } from "../../database/Transaction"
import userCan from "../../utils/userCan"
import { Op } from "sequelize"
import { client } from "../../config/square"
import { v4 as uuidv4 } from "uuid"
import sendEmail from "../../utils/sendEmail"
import axios from "axios"

const app = new Hono<{ Variables: HonoVariables }>()

// Get payments for a user
app.get("/:user_id", authMiddleware("payments_read"), async (c) => {
  const query = c.req.query()
  const { all, page = "1", limit = "20" } = query

  const { user_id } = c.req.param()
  if (!user_id) throw new Error("user_id is required")

  const order: any = [["createdAt", "DESC"]]
  const where: any = { type: { [Op.or]: ["payment", "card"] }, user_id }

  // Create mock request for userCan compatibility
  const mockReq = { user: c.get("user"), token_owner: c.get("token_owner") }

  // @ts-ignore
  if (all && userCan(mockReq, "payments_read_all")) {
    delete where.user_id
  }

  const pageNum = Number(page)
  const limitNum = Number(limit)

  // @ts-ignore
  const payments = await Transaction.findAll({
    where,
    order,
    limit: limitNum,
    offset: (pageNum - 1) * limitNum,
  })

  const total = await Transaction.count({ where })

  return c.json({
    success: "success",
    data: payments,
    page: pageNum,
    limit: limitNum,
    total,
  })
})

// Create payment
app.post("/", authMiddleware("payments_create"), async (c) => {
  const body = await c.req.json()
  // Create mock request for createPayment compatibility
  const mockReq = {
    body,
    user: c.get("user"),
    headers: Object.fromEntries(c.req.raw.headers.entries()),
  }

  const response = await createPayment(mockReq as any)
  return c.json(response)
})

// Refund payment
app.post("/refund", authMiddleware("payments_create"), async (c) => {
  const body = await c.req.json()
  let { user_id, transaction_id } = body

  try {
    if (!user_id) throw new Error("0001D user_id is required")
    if (!transaction_id) throw new Error("0001E transaction_id is required")

    const transaction = await Transaction.findOne({
      where: { type: "payment", square_transaction_id: transaction_id },
    })
    if (!transaction) throw new Error("0001F transaction not found")

    const { amount, db_transaction_id } = transaction.dataValues

    const response = await client.refundsApi.refundPayment({
      idempotencyKey: uuidv4(),
      paymentId: transaction_id,
      amountMoney: {
        amount,
        currency: "USD",
      },
      unlinked: false,
    })

    const status = response?.result?.refund?.status
    if (status !== "COMPLETED" && status !== "PENDING") {
      throw new Error("0001G refund failed")
    }

    // Log refund and send email
    try {
      const refundedUser = await axios.get(
        `${process.env.API_URL}/users/${user_id}`,
        {
          headers: {
            "x-api-token": process.env.API_MASTER_TOKEN,
          },
        }
      )
      const email = refundedUser?.data?.data?.email

      Transaction.create({
        user_id,
        amount,
        type: "refund",
        memo: "Refund completed",
        status: "completed",
        data: JSON.stringify(response),
        db_transaction_id,
      })

      // Update the original transaction to refunded
      transaction.update({ status: "refunded" })

      await sendEmail({
        to: email,
        subject: "Payment Refunded",
        text: `Payment of $${amount / 100} was refunded`,
        template: "refund.html",
        fields: {
          amount: `$${(amount / 100).toFixed(2)}`,
          date: new Date().toLocaleDateString(),
        },
      })

      return c.json({ success: "success", data: response })
    } catch (error: any) {
      await sendEmail({
        to: process.env.ADMIN_EMAIL!,
        subject: "Payment Refund Logging Error",
        text: `There was an error logging a refund: ${error.message}`,
      })

      return c.json({
        success: "success",
        data: response,
        warning: "Refund completed, but failed to log",
      })
    }
  } catch (error: any) {
    Transaction.create({
      user_id,
      amount: 0,
      type: "refund",
      memo: "Refund failed",
      status: "failed",
      data: JSON.stringify(error),
    })

    return c.json({ success: "error", error: error.message })
  }
})

export const paymentRoutes = app
