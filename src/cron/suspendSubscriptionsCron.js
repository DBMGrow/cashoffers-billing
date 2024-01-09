import sendEmail from "../utils/sendEmail"
import { Transaction } from "../database/Transaction"
import { Subscription } from "../database/Subscription"
import { Op } from "sequelize"
import toggleSubscription from "../utils/toggleSubscription"

export default async function suspendSubscriptionsCron() {
  try {
    // find all subscriptions with a status of active and a renewal_date over 11 days ago
    const subscriptions = await Subscription.findAll({
      where: {
        status: "active",
        renewal_date: {
          [Op.lte]: new Date(new Date() - 11 * 24 * 60 * 60 * 1000),
        },
      },
    })
    // loop through subscriptions and suspend them
    subscriptions.forEach(async (subscription) => {
      await toggleSubscription(subscription.subscription_id, { status: "suspend" })
    })
  } catch (error) {
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: "Subscription Cron Error",
      text: `There was an error suspending subscriptions: ${error.message}`,
    })
    Transaction.create({
      user_id: 0,
      type: "cron",
      memo: "Suspend Subscriptions failed",
      status: "failed",
      data: JSON.stringify(error),
    })
  }
}
