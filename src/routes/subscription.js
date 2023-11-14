import express from "express"
import authMiddleware from "../middleware/authMiddleware"
import { Subscription } from "../database/Subscription"
import { UserCard } from "../database/UserCard"
import { Transaction } from "../database/Transaction"

const router = express.Router()

router.get("/", authMiddleware("payments_read_all"), async (req, res) => {
  try {
    const subscriptions = await Subscription.findAll()
    res.json({ success: "success", data: subscriptions })
  } catch (error) {
    res.json({ success: "error", error: error.message })
  }
})

router.put("/", authMiddleware("payments_create"), async (req, res) => {
  const { user_id, subscription_name, amount, duration, status } = req.body

  try {
    const updateBody = {}
    if (subscription_name) updateBody.subscription_name = subscription_name
    if (amount) updateBody.amount = amount
    if (duration) updateBody.duration = duration
    if (status) updateBody.status = status

    await Subscription.update(updateBody, { where: { user_id } })

    // log transaction
    await Transaction.create({
      user_id,
      amount: 0,
      type: "subscription",
      memo: subscription_name + " updated",
      data: JSON.stringify(updateBody),
    })

    res.json({ success: "success", data: updateBody })
  } catch (error) {
    // log transaction
    await Transaction.create({
      user_id,
      amount: 0,
      type: "subscription",
      memo: subscription_name + " failed to update",
      data: error.message,
    })
    res.json({ success: "error", error: error.message, body: req.body })
  }
})

router.post("/", authMiddleware("payments_create"), async (req, res) => {
  // create a new subscription, or update an existing one
  const { subscription_name, user_id, amount, duration } = req.body

  // todo: add libary of subscriptions

  try {
    if (!subscription_name) throw new Error("subscription_name is required")
    if (!user_id) throw new Error("user_id is required")
    if (!amount) throw new Error("amount is required")
    if (!duration) throw new Error("duration is required")

    // get card token from database
    const userCard = await UserCard.findOne({ where: { user_id } })
    if (!userCard) throw new Error("No card found")
    const card_id = userCard?.dataValues?.card_id

    // get subscription from database
    const subscription = await Subscription.findOne({ where: { user_id } })
    const updateData = {
      subscription_name,
      user_id,
      card_id,
      amount,
      duration,
      renewal_date: new Date(),
      status: "active",
    }
    if (subscription) await Subscription.update(updateData, { where: { user_id } })
    else await Subscription.create(updateData)

    // log transaction
    await Transaction.create({
      user_id,
      amount,
      type: "subscription",
      memo: subscription_name + " created",
    })

    res.json({ success: "success", data: updateData })
  } catch (error) {
    res.json({ success: "error", error: error.message, body: req.body })
  }
})

router.delete("/", authMiddleware("payments_delete"), async (req, res) => {
  // deactivate a subscription by user_id
  const { user_id } = req.body

  try {
    if (!user_id) throw new Error("user_id is required")

    await Subscription.update({ status: "inactive" }, { where: { user_id } })

    res.json({ success: "success", data: { user_id } })
  } catch (error) {
    res.json({ success: "error", error: error.message, body: req.body })
  }
})

const subscriptionRoutes = router
export default subscriptionRoutes
