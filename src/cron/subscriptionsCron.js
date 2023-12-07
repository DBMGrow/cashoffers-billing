import { Op } from "sequelize"
import { Subscription } from "../database/Subscription"
import { Transaction } from "../database/Transaction"
import fetch from "node-fetch"
import sendEmail from "../utils/sendEmail"
import handlePaymentOfSubscription from "../utils/handlePaymentOfSubscription"
import toggleSubscription from "../utils/toggleSubscription"

export default async function subscriptionsCron() {
  console.log("Running subscriptions cron")

  try {
    const subscriptions = await Subscription.findAll({
      where: {
        [Op.or]: [{ status: "active" }, { status: "suspended" }],
        next_renewal_attempt: {
          [Op.or]: {
            [Op.lte]: new Date(),
            [Op.is]: null,
          },
        },
        renewal_date: {
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
      if (subscription.dataValues?.cancel_on_renewal) {
        await toggleSubscription(subscription.subscription_id, { status: "cancel", scramble: true })
        return
      }

      const email = users?.data?.find((user) => user.user_id === subscription.user_id).email
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
