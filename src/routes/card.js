import authMiddleware from "../middleware/authMiddleware"
import express from "express"
import sendEmail from "../utils/sendEmail"
import { client } from "../config/square"
import { v4 as uuidv4 } from "uuid"
import { Transaction } from "../database/Transaction"
import { UserCard } from "../database/UserCard"

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
  let { user_id, card_token, exp_month, exp_year, notification_email, cardholder_name } = req.body

  try {
    if (!user_id) throw new Error("user_id is required")
    if (!card_token) throw new Error("card_token is required")
    if (!exp_month) throw new Error("exp_month is required")
    if (!exp_year) throw new Error("exp_year is required")
    if (!notification_email) throw new Error("notification_email is required")
    if (!notification_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) throw new Error("notification_email is not valid")
    if (!cardholder_name) throw new Error("cardholder_name is required")

    //create customer in square
    const customer = await client.customersApi.createCustomer({
      idempotencyKey: uuidv4(),
      emailAddress: notification_email,
    })
    const customerId = customer?.result?.customer?.id
    if (!customerId) throw new Error("customer creation failed")

    // create card in square
    const response = await client.cardsApi.createCard({
      idempotencyKey: uuidv4(),
      sourceId: card_token,
      card: {
        expMonth: exp_month,
        expYear: exp_year,
        customerId,
      },
    })

    // parse response from square and format for database
    const card = JSON.parse(response.body)?.card
    const card_data = {
      user_id,
      card_id: card.id,
      last_4: card.last_4,
      card_brand: card.card_brand,
      exp_month: card.exp_month,
      exp_year: card.exp_year,
      notification_email,
      cardholder_name,
      square_customer_id: customerId,
    }

    // Check if user_id already has a card in database
    const userCard = await UserCard.findOne({ where: { user_id } })
    let creatingNewCard = true
    if (userCard) {
      creatingNewCard = false
      userCard.update(card_data)
    } else {
      UserCard.create(card_data)
    }

    // send email
    const creatingNewCardMessage = `A Card ending in ${card.last_4} was added to your account`
    const updatingCardMessage = `The Card linked to your account was updated and now ends in ${card.last_4}`
    sendEmail({
      to: notification_email,
      subject: creatingNewCard ? "A Card Was Added to Your Account" : "The Card on Your Account Was Updated",
      text: creatingNewCard ? creatingNewCardMessage : updatingCardMessage,
    })

    // log transaction
    Transaction.create({
      user_id,
      amount: 0,
      type: "card",
      memo: creatingNewCard ? "card created" : "card updated",
      data: JSON.stringify(response),
    })

    res.json({ success: "success", data: response })
  } catch (error) {
    console.error(error?.result?.errors?.[0]?.detail)
    const errorMessage = error?.result?.errors?.[0]?.detail || error.message

    Transaction.create({
      user_id,
      amount: 0,
      type: "card",
      memo: errorMessage,
      data: error.message,
    })

    res.json({ success: "error", error: errorMessage, body: req.body })
  }
})

const cardRoutes = router
export default cardRoutes
