import { Op } from "sequelize"
import { Subscription } from "../database/Subscription"
import { Transaction } from "../database/Transaction"
import fetch from "node-fetch"
import sendEmail from "../utils/sendEmail"
import toggleSubscription from "../utils/toggleSubscription"
import { getContainer } from "@/container"

export default async function subscriptionsCron() {
  console.log("Running subscriptions cron")

  try {
    const subscriptions = await Subscription.findAll({
      where: {
        [Op.or]: [
          { status: "active" },
          // { status: "suspend" } // Updated to only process active subscriptions
        ],
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

    console.log("Subscriptions to process: ", subscriptions.length)
    console.log(
      "Subscriptions: ",
      subscriptions.map((sub: any) => sub.subscription_id)
    )

    const usersResponse = await fetch(process.env.API_URL + "/users/mini?page=1&limit=50000", {
      headers: {
        "x-api-token": process.env.API_MASTER_TOKEN!,
      },
    })
    const users: any = await usersResponse.json()

    if (users?.success !== "success") throw new Error("Error fetching users")

    // Get container and use case
    const container = getContainer()
    const renewSubscriptionUseCase = container.useCases.renewSubscription

    for (const subscription of subscriptions) {
      const subscriptionData = (subscription as any).dataValues || subscription
      console.log("Processing subscription", subscriptionData.subscription_id)

      if (subscriptionData.cancel_on_renewal) {
        await toggleSubscription(subscriptionData.subscription_id, { status: "cancel" })
        continue
      } else if (subscriptionData.downgrade_on_renewal) {
        await toggleSubscription(subscriptionData.subscription_id, { status: "downgrade" })
        continue
      }

      const user = users?.data?.find((u: any) => u.user_id === subscriptionData.user_id)
      const email = user?.email || ""

      if (!email) {
        console.log("No email found for user_id: ", subscriptionData.user_id)
        continue
      }

      // if user active = 0, skip subscription renewal attempt
      if (user?.active === 0) {
        console.log("User is inactive, skipping subscription renewal attempt for user_id: ", subscriptionData.user_id)
        continue
      }

      // Use the RenewSubscriptionUseCase
      try {
        const result = await renewSubscriptionUseCase.execute({
          subscriptionId: subscriptionData.subscription_id,
          email,
        })

        if (result.success) {
          console.log(`Successfully renewed subscription ${subscriptionData.subscription_id}`)
        } else {
          console.error(`Failed to renew subscription ${subscriptionData.subscription_id}:`, result.error)
        }
      } catch (error: any) {
        console.error(`Error renewing subscription ${subscriptionData.subscription_id}:`, error.message)
      }
    }
  } catch (error: any) {
    await sendEmail({
      to: process.env.ADMIN_EMAIL!,
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
