import express from "express"
import authMiddleware from "../middleware/authMiddleware"
import createPayment from "../utils/createPayment"
import { Transaction } from "../database/Transaction"

const router = express.Router()

router.get("/:user_id", authMiddleware("payments_read"), async (req, res) => {
  try {
    const { user_id } = req.params
    if (!user_id) throw new Error("user_id is required")
    const payments = await Transaction.findAll({ where: { type: "payment", user_id } })
    res.json({ success: "success", data: payments })
  } catch (error) {
    res.json({ success: "error", error: error.message })
  }
})

router.post("/", authMiddleware("payments_create"), async (req, res) => {
  const response = await createPayment(req.body)
  res.json(response)
})

const paymentRoutes = router
export default paymentRoutes
