import express from "express"
import authMiddleware from "../middleware/authMiddleware"
import createPayment from "../utils/createPayment"
import { Transaction } from "../database/Transaction"
import userCan from "../utils/userCan"
import { Sequelize } from "sequelize"
import { client } from "../config/square"
import { v4 as uuidv4 } from "uuid"
import sendEmail from "../utils/sendEmail"
import axios from "axios"

const router = express.Router()
const Op = Sequelize.Op

router.get("/:user_id", authMiddleware("payments_read"), async (req, res) => {
  const { all, page = 1, limit = 20 } = req.query

  try {
    const { user_id } = req.params
    if (!user_id) throw new Error("user_id is required")

    const order = [["createdAt", "DESC"]]
    const where = { type: { [Op.or]: ["payment", "card"] }, user_id }

    if (all && userCan(req, "payments_read_all")) delete where.user_id

    const payments = await Transaction.findAll({ where, order, limit, offset: page * limit })
    const total = await Transaction.count({ where })
    res.json({ success: "success", data: payments, page: Number(page), limit: Number(limit), total })
  } catch (error) {
    res.json({ success: "error", error: error.message })
  }
})

router.post("/", authMiddleware("payments_create"), async (req, res) => {
  const response = await createPayment(req)
  res.json(response)
})

router.post("/refund", authMiddleware("payments_create"), async (req, res) => {
  let { user_id, transaction_id } = req.body
  try {
    if (!user_id) throw new Error("0001D user_id is required")
    if (!transaction_id) throw new Error("0001E transaction_id is required")

    const transaction = await Transaction.findOne({ where: { type: "payment", square_transaction_id: transaction_id } })
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
    if (status !== "COMPLETED" && status !== "PENDING") throw new Error("0001G refund failed")

    // if status is completed, the transaction worked, so log as completed
    try {
      const refundedUser = await axios.get(`${process.env.API_URL}/users/${user_id}`, {
        headers: {
          "x-api-token": process.env.API_MASTER_TOKEN,
        },
      })
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

      //update the original transaction to refunded
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

      res.json({ success: "success", data: response })
    } catch (error) {
      await sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: "Payment Refund Logging Error",
        text: `There was an error logging a refund: ${error.message}`,
      })

      res.json({ success: "success", data: response, warning: "Refund completed, but failed to log" })
    }
  } catch (error) {
    Transaction.create({
      user_id,
      amount: 0,
      type: "refund",
      memo: "Refund failed",
      status: "failed",
      data: JSON.stringify(error),
    })

    res.json({ success: "error", error: error.message })
  }
})

const paymentRoutes = router
export default paymentRoutes
