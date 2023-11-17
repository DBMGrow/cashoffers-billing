import authMiddleware from "../middleware/authMiddleware"
import express from "express"
import { UserCard } from "../database/UserCard"
import createCard from "../utils/createCard"
import handleErrors from "../utils/handleErrors"

const router = express.Router()

router.get("/:[user_id]", authMiddleware(), async (req, res) => {
  const { user_id } = req.params

  try {
    if (!user_id) throw new Error("user_id is required")

    const userCard = await UserCard.findOne({ where: { user_id } })
    if (!userCard) throw new Error("No card found")

    res.json({ success: "success", data: userCard })
  } catch (error) {
    res.json({ success: "error", error: error.message })
  }
})

router.get("/:user_id/info", authMiddleware(), async (req, res) => {
  // check if the user has a card in the system
  const { user_id } = req.params
  try {
    if (!user_id) throw new Error("0001C: user_id is required")

    const userCard = await UserCard.findOne({ where: { user_id } })
    if (!userCard) return res.json({ success: "success", data: { has_card: false } })

    res.json({ success: "success", data: { has_card: true, ...userCard } })
  } catch (error) {
    res.json({ success: "error", error: error.message })
  }
})

router.post("/", authMiddleware(), async (req, res) => {
  let { user_id, card_token, exp_month, exp_year, cardholder_name } = req.body

  try {
    const response = await createCard(user_id, card_token, exp_month, exp_year, cardholder_name, req?.user?.email, {
      allowNullUserId: false,
    })

    res.json({ success: "success", data: response?.data })
  } catch (error) {
    return handleErrors(req, res, error)
  }
})

const cardRoutes = router
export default cardRoutes
