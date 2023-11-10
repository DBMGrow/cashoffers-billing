import { UserCard } from "../database/UserCard"
import { Transaction } from "../database/Transaction"
import getUser from "./getUser"
import { client } from "../config/square"
import { v4 as uuidv4 } from "uuid"
import sendEmail from "./sendEmail"

export default async function createPayment(request) {
  let { amount, user_id } = request

  try {
    if (!amount) throw new Error("amount is required")
    if (typeof amount != "number") amount = parseFloat(amount)
    if (isNaN(amount)) throw new Error("amount must be a number")
    if (amount < 1) throw new Error("amount must be at least 1 cent")
    if (!user_id) throw new Error("user_id is required")

    // get card token from database
    const userCard = await UserCard.findOne({ where: { user_id } })
    if (!userCard) throw new Error("No card found")
    const { card_id, notification_email, square_customer_id } = userCard?.dataValues

    if (!card_id) throw new Error("No card found")
    if (!square_customer_id) throw new Error("No square customer found for this card")

    const response = await client.paymentsApi.createPayment({
      sourceId: card_id,
      idempotencyKey: uuidv4(),
      amountMoney: {
        amount,
        currency: "USD",
      },
      autocomplete: true,
      customerId: square_customer_id,
      acceptPartialAuthorization: false,
    })

    return handlePaymentResults(request, response, notification_email)
  } catch (error) {
    //handle failed payment
    sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: "Payment Error",
      text: `There was an error processing a payment: ${error.message}`,
    })

    return { success: "error", error: error.message, body: request }
  }
}

async function handlePaymentResults(request, response, notification_email) {
  const { amount, user_id, memo } = request

  try {
    if (!paymentCompleted(request, response)) throw new Error("Payment failed")
    // log transaction
    await Transaction.create({
      user_id,
      amount,
      type: "payment",
      memo,
      data: JSON.stringify(response),
    })

    // send email
    sendEmail({
      to: notification_email,
      subject: "Payment Successful",
      text: `Payment of $${amount / 100} was successful`,
    })

    return { success: "success", data: JSON.parse(response.body) }
  } catch (error) {
    return { success: "error", error: error.message, body: request }
  }
}

async function paymentCompleted(request, response) {
  const { user_id, amount } = request

  try {
    // check if transaction was successful
    const status = JSON.parse(response.body)?.payment?.status
    if (status !== "COMPLETED") throw new Error("Payment failed")

    return true
  } catch (error) {
    if (error.message !== "Payment failed") {
      // this means a syntax error or something else went wrong
      // send email to admin to investigate
      sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: "Payment Error",
        text: `0000A: There was an error processing a payment: ${error.message}`,
      })
      return false
    }

    // need to notify user their card info likely needs to be updated
    sendEmail({
      to: notification_email,
      subject: "Payment Error",
      text: `A payment of $${amount / 100} failed. Please update your card information.`,
    })

    await Transaction.create({
      user_id,
      amount,
      type: "payment",
      memo: "Payment failed",
      data: JSON.stringify(response),
    })
  }
}
