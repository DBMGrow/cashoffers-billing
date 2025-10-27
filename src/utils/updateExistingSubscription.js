import { Transaction } from "../database/Transaction"
import { Subscription } from "../database/Subscription"
import CodedError from "./CodedError"
import fetch from "node-fetch"
import convertToFormata from "./convertToFormdata"
import sendEmail from "./sendEmail"

export default async function updateExistingSubscription(product, user) {
  try {
    const newSubscriptionData = { ...product?.dataValues?.data }
    if (!newSubscriptionData?.duration) throw new CodedError("duration is required", "UES01")
    if (!newSubscriptionData?.renewal_cost) throw new CodedError("renewal_cost is required", "UES02")

    // get existing subscription
    const subscription = await Subscription.findOne({ where: { user_id: user.user_id } })
    if (!subscription) throw new CodedError("subscription not found", "UES03")

    // if team subscription, update team
    // if current subscription does not have a team, create it
    // if current subscription has a team, update max team members
    let team_id = subscription?.dataValues?.data?.team_id
    if (newSubscriptionData?.team) {
      if (!team_id) {
        // create new team
        if (!newSubscriptionData?.team_members) throw new CodedError("team_members is required", "UES04")

        const teamRequest = await fetch(process.env.API_URL + "/teams", {
          method: "POST",
          headers: { "x-api-token": process.env.API_MASTER_TOKEN },
          body: convertToFormata({
            teamname: (user?.name || user?.email) + "'s Team",
            max_users: newSubscriptionData?.team_members,
          }),
        })
        const team = await teamRequest.json()
        if (team?.success !== "success") throw new CodedError(JSON.stringify(team), "UES05")
        team_id = team?.data?.team_id

        // update user to be team owner and part of new team
        const userRequest = await fetch(process.env.API_URL + "/users/" + user.user_id, {
          method: "PUT",
          headers: { "x-api-token": process.env.API_MASTER_TOKEN },
          body: convertToFormata({
            team_id: team?.data?.team_id,
            role: "TEAMOWNER",
            is_premium: 1,
          }),
        })
        const userUpdate = await userRequest.json()
        if (userUpdate?.success !== "success") throw new CodedError(JSON.stringify(userUpdate), "UES06")

        // update subscription.data.team_id to be team_id of new team
        newSubscriptionData.team_id = team?.data?.team_id
      } else {
        // update existing team
        const teamRequest = await fetch(process.env.API_URL + "/teams/" + subscription?.data?.team_id, {
          method: "PUT",
          headers: { "x-api-token": process.env.API_MASTER_TOKEN },
          body: convertToFormata({
            max_users: newSubscriptionData?.team_members,
          }),
        })
        const team = await teamRequest.json()
        if (team?.success !== "success") throw new CodedError(JSON.stringify(team), "UES07")

        team_id = subscription?.data?.team_id
      }
    } else {
      // if current subscription has a team, remove user from team

      if (team_id) {
        const userRequest = await fetch(process.env.API_URL + "/users/" + user.user_id, {
          method: "PUT",
          headers: { "x-api-token": process.env.API_MASTER_TOKEN },
          body: convertToFormata({
            role: "AGENT",
            is_premium: 1,
          }),
        })
        const userUpdate = await userRequest.json()

        if (userUpdate?.success !== "success") throw new CodedError(JSON.stringify(userUpdate), "UES09")

        // update subscription.data.team_id to be null
        newSubscriptionData.team_id = null
        newSubscriptionData.team = false
        team_id = null
      }
    }

    // update subscription in the db to be the new subscription
    const updatedSubscription = await subscription.update({
      subscription_name: product?.dataValues?.product_name,
      product_id: product?.dataValues?.product_id,
      amount: newSubscriptionData?.renewal_cost,
      duration: newSubscriptionData?.duration,
      status: "active",
      data: {
        ...subscription?.dataValues?.data,
        ...newSubscriptionData,
        team_id,
      },
    })
    if (!updatedSubscription) throw new CodedError("subscription update failed", "UES08")

    // log subscription update
    await Transaction.create({
      user_id: user.user_id,
      type: "subscription",
      data: JSON.stringify(updatedSubscription),
      memo: "Subscription updated",
      status: "completed",
    })

    // send email to user
    await sendEmail({
      to: user?.email,
      subject: "Subscription Plan Updated",
      text: `Your subscription has been updated to ${product?.dataValues?.product_name}`,
      template: "subscriptionPlanUpdated.html",
      fields: {
        subscription: product?.dataValues?.product_name,
        amount: `$${(newSubscriptionData?.renewal_cost / 100).toFixed(2)}`,
        date: new Date().toLocaleDateString(),
      },
    })

    return { success: "success", data: subscription }
  } catch (error) {
    return { success: "error", error: error.message, code: error.code }
  }
}
