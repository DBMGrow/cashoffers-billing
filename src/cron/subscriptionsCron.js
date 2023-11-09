import { Op } from "sequelize"
import { Subscription } from "../database/Subscription"
import { Transaction } from "../database/Transaction"
import createPayment from "../utils/createPayment"
import sendEmail from "../utils/sendEmail"

export default async function subscriptionsCron() {
  const subscriptions = await Subscription.findAll({
    where: {
      status: "active",
      renewal_date: {
        [Op.lte]: new Date(),
      },
    },
  })

  // loop through subscriptions
  subscriptions.forEach(async (subscription) => {
    await handlePaymentOfSubscription(subscription)
  })
}

async function handlePaymentOfSubscription(subscription) {
  const { user_id, amount, subscription_name: memo, notification_email, duration } = subscription.dataValues

  try {
    const response = await createPayment({ user_id, amount, memo })
    if (response?.data?.payment?.status !== "COMPLETED") throw new Error("Payment failed")

    // update subscription renewal_date
    const renewal_date = new Date()
    renewal_date.setDate(renewal_date.getDate() + duration)
    subscription.update({ renewal_date })

    // send email
    sendEmail({
      to: notification_email,
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
    sendEmail({
      to: notification_email,
      subject: "Subscription Renewal Failed",
      text: `Subscription ${memo} failed to renew`,
    })

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
