import CodedError from "../config/CodedError"
import sendEmail from "../utils/sendEmail"
import { Op } from "sequelize"
import { client } from "../config/square"
import { v4 as uuidv4 } from "uuid"
import { Transaction } from "../database/Transaction"
import { UserCard } from "../database/UserCard"
import { Subscription } from "../database/Subscription"
import handlePaymentOfSubscription from "./handlePaymentOfSubscription"

export default async function createCard(user_id, card_token, exp_month, exp_year, cardholder_name, email, options) {
  const { allowNullUserId, sendEmailOnUpdate = true, attemptRenewal = true } = options || {}

  if (!user_id && !allowNullUserId) throw new CodedError("user_id is required", "CAR01")
  if (!card_token) throw new CodedError("card_token is required", "CAR02")
  if (!exp_month) throw new CodedError("exp_month is required", "CAR03")
  if (!exp_year) throw new CodedError("exp_year is required", "CAR04")
  if (!cardholder_name) throw new CodedError("cardholder_name is required", "CAR05")

  const errorOptions = { actions: "log" }

  // create customer in square
  const customer = await client.customersApi.createCustomer({
    idempotencyKey: uuidv4(),
    emailAddress: email,
  })
  const customerId = customer?.result?.customer?.id
  if (!customerId) throw new CodedError("customer creation failed", "CAR06", errorOptions)

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
    user_id: user_id ?? null,
    card_id: card.id,
    last_4: card.last_4,
    card_brand: card.card_brand,
    exp_month: card.exp_month,
    exp_year: card.exp_year,
    cardholder_name,
    square_customer_id: customerId,
  }

  // Check if user_id already has a card in database
  let userCard
  let creatingNewCard = true

  if (user_id) userCard = await UserCard.findOne({ where: { user_id } })
  if (userCard && user_id) {
    userCard = await userCard.update(card_data)
    creatingNewCard = false
  } else {
    userCard = await UserCard.create(card_data)
  }

  if (attemptRenewal) {
    // find all subscriptions where
    const subscriptions = await Subscription.findAll({
      where: {
        [Op.or]: [{ status: "active" }, { status: "suspend" }],
        renewal_date: {
          [Op.or]: {
            [Op.lte]: new Date(),
            [Op.is]: null,
          },
        },
        user_id,
      },
    })
    // loop through subscriptions and attempt to pay them with the new card
    subscriptions.forEach(async (subscription) => {
      await handlePaymentOfSubscription(subscription, email)
    })
  }

  // send email
  if (sendEmailOnUpdate) {
    const creatingNewCardMessage = `A Card ending in ${card.last_4} was added to your account`
    const updatingCardMessage = `The Card linked to your account was updated and now ends in ${card.last_4}`
    await sendEmail({
      to: email,
      subject: creatingNewCard ? "A Card Was Added to Your Account" : "The Card on Your Account Was Updated",
      text: creatingNewCard ? creatingNewCardMessage : updatingCardMessage,
      template: "cardUpdated.html",
      fields: {
        message: creatingNewCard ? creatingNewCardMessage : updatingCardMessage,
        card: `**** **** **** ${card.last_4}`,
        date: new Date().toLocaleDateString(),
      },
    })
  }

  // log transaction
  Transaction.create({
    user_id,
    amount: 0,
    type: "card",
    memo: creatingNewCard ? "Card Created" : "Card Updated",
    data: JSON.stringify(response),
  })

  return { success: "success", data: response, userCard }
}
