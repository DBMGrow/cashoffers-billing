import { Op } from "sequelize"
import { Subscription } from "../database/Subscription"
import { Transaction } from "../database/Transaction"
import createPayment from "../utils/createPayment"
import fetch from "node-fetch"
import sendEmail from "../utils/sendEmail"
import createNewRenewalDate from "../utils/createNewRenewalDate"

export default async function subscriptionsCron() {
  try {
    const subscriptions = await Subscription.findAll({
      where: {
        status: "active",
        next_renewal_attempt: {
          [Op.or]: {
            [Op.lte]: new Date(),
            [Op.is]: null,
          },
        },
      },
    })

    const usersResponse = await fetch(process.env.API_URL + "/users", {
      headers: {
        "x-api-token": process.env.API_MASTER_TOKEN,
      },
    })
    const users = await usersResponse.json()

    if (users?.success !== "success") throw new Error("Error fetching users")

    // loop through subscriptions
    subscriptions.forEach(async (subscription) => {
      //add to every subscription the email of the matching user
      const email = users?.data?.find((user) => user.user_id === subscription.user_id).email
      // console.log(subscription, email)
      await handlePaymentOfSubscription(subscription, email)
    })

    Transaction.create({
      user_id: 0,
      amount: 0,
      type: "cron",
      memo: "Subscriptions cron ran successfully",
      status: "completed",
    })
  } catch (error) {
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: "Subscription Cron Error",
      text: `There was an error processing subscriptions: ${error.message}`,
    })
    Transaction.create({
      user_id: 0,
      amount: 0,
      type: "cron",
      memo: "Subscriptions failed",
      status: "failed",
      data: JSON.stringify(error),
    })
  }
}

async function handlePaymentOfSubscription(subscription, email) {
  const { user_id, amount, subscription_name: memo, duration } = subscription.dataValues

  try {
    let req = { body: { amount, user_id, memo }, user: { email } }
    if (!email) throw new Error("No email found for this subscription")
    const response = await createPayment(req)
    if (response?.data?.payment?.status !== "COMPLETED")
      throw new Error("0002A: Payment failed |" + JSON.stringify(response))

    // update subscription renewal_date
    const renewal_date = createNewRenewalDate(subscription)
    subscription.update({ renewal_date, next_renewal_attempt: renewal_date })

    // send email
    await sendEmail({
      to: email,
      subject: "Subscription Renewal",
      text: `Subscription ${memo} was renewed`,
    })

    // log transaction
    Transaction.create({
      user_id,
      amount,
      type: "subscription",
      memo,
      data: JSON.stringify(response),
    })
  } catch (error) {
    // send email
    await sendEmail({
      to: email || process.env.ADMIN_EMAIL,
      subject: "Subscription Renewal Failed",
      text: `Subscription ${memo} failed to renew`,
    })

    // update subscription next_renewal_attempt
    updateNextRenewalAttempt(subscription)

    // log transaction
    Transaction.create({
      user_id,
      amount,
      type: "subscription",
      memo: memo + " (failed)",
      data: error.message,
    })
  }
}

function updateNextRenewalAttempt(subscription) {
  // update subscription next_renewal_attempt
  // logic of days waited: 1, 3, then keep attempting at 7
  const { next_renewal_attempt } = subscription.dataValues
  let daysWaited = 0
  if (next_renewal_attempt) {
    daysWaited = (new Date() - next_renewal_attempt) / (1000 * 60 * 60 * 24)
  }
  let nextAttempt = new Date()
  const today = new Date()
  console.log("Days waited", daysWaited)

  if (daysWaited <= 1) {
    nextAttempt.setDate(today.getDate() + 1)
  } else if (daysWaited <= 4) {
    nextAttempt.setDate(today.getDate() + 3)
  } else {
    nextAttempt.setDate(today.getDate() + 7)
  }

  subscription.update({ next_renewal_attempt: nextAttempt })
}
