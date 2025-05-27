import { UserCard } from "../database/UserCard"
import { Transaction } from "../database/Transaction"
import { client } from "../lib/square"
import { v4 as uuidv4 } from "uuid"
import sendEmail from "./sendEmail"

export default async function chargeCardSingle(req, options) {
  let { amount, card_token } = req?.body
  let { email, user_id } = req?.user

  try {
    if (!amount) throw new Error("amount is required")
    if (typeof amount != "number") amount = parseFloat(amount)
    if (isNaN(amount)) throw new Error("amount must be a number")
    if (amount < 1) throw new Error("amount must be at least 1 cent")
    if (!user_id) throw new Error("user_id is required")
    if (!card_token) throw new Error("No card found")

    const response = await client.paymentsApi.createPayment({
      sourceId: card_token,
      idempotencyKey: uuidv4(),
      amountMoney: {
        amount,
        currency: "USD",
      },
      autocomplete: true,
      acceptPartialAuthorization: false,
    })

    return handlePaymentResults(req, response, email, options)
  } catch (error) {
    //handle failed payment
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: "Payment Error",
      text: `There was an error processing a payment: ${error.message}`,
    })

    return { success: "error", error: error.message }
  }
}

async function handlePaymentResults(req, response, email, options) {
  const { amount, memo } = req.body
  const { user_id } = req.user
  let { sendEmailOnCharge = true } = options || {}

  try {
    if (!paymentCompleted(req, response)) throw new Error("0002B: Payment failed")
    // log transaction
    await Transaction.create({
      user_id,
      amount,
      type: "payment",
      product_id: req?.body?.product_id,
      memo,
      status: "completed",
      square_transaction_id: response?.result?.payment?.id,
      data: JSON.stringify(response),
    })

    let amountFormatted = amount / 100
    amountFormatted = `$${amountFormatted.toFixed(2)}`

    // send email
    if (sendEmailOnCharge) {
      await sendEmail({
        to: email,
        subject: "Payment Successful",
        text: `Payment of ${amountFormatted} was successful`,
        template: "paymentConfirm.html",
        fields: {
          amount: `$${amountFormatted}`,
          transactionID: response?.result?.payment?.id,
          date: new Date().toLocaleDateString(),
        },
      })
    }

    return { success: "success", data: JSON.parse(response.body) }
  } catch (error) {
    return { success: "error", error: error.message }
  }
}

async function paymentCompleted(req, response) {
  const { user_id, amount } = req

  try {
    // check if transaction was successful
    const status = JSON.parse(response.body)?.payment?.status
    if (status !== "COMPLETED") throw new Error("Payment failed")

    return true
  } catch (error) {
    if (error.message !== "0002B: Payment failed") {
      // this means a syntax error or something else went wrong
      // send email to admin to investigate
      await sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: "Payment Error",
        text: `0000A: There was an error processing a payment: ${error.message}`,
      })
      return false
    }

    // need to notify user their card info likely needs to be updated
    let amountFormat = amount / 100
    amountFormat = `$${amountFormat.toFixed(2)}`

    await sendEmail({
      to: email,
      subject: "Payment Error",
      text: `A payment of ${amountFormat} failed. Please update your card information.`,
      template: "paymentError.html",
      fields: {
        amount: amountFormat,
        date: new Date().toLocaleDateString(),
      },
    })

    await Transaction.create({
      user_id,
      amount,
      type: "payment",
      product_id: req?.body?.product_id,
      memo: "0002C: Payment failed",
      status: "failed",
      data: JSON.stringify(response),
    })
  }
}
