import { Subscription } from "../database/Subscription"
import { Transaction } from "../database/Transaction"
import CodedError from "../config/CodedError"
import fetch from "node-fetch"
import convertToFormata from "./convertToFormdata"
import handlePaymentOfSubscription from "./handlePaymentOfSubscription"

export default async function createNewSubscription(product, user) {
  try {
    const subscriptionData = { ...product?.dataValues?.data }
    if (!subscriptionData?.duration) throw new CodedError("duration is required", "CNS01")
    if (!subscriptionData?.renewal_cost) throw new CodedError("renewal_cost is required", "CNS02")

    // activate user
    const activateUser = await fetch(process.env.API_URL + "/users/" + user.user_id, {
      method: "PUT",
      headers: { "x-api-token": process.env.API_MASTER_TOKEN },
      body: convertToFormata({ active: 1 }),
    })
    const activateUserResponse = await activateUser.json()
    if (activateUserResponse?.success !== "success") throw new CodedError("user activation failed", "CNS03")

    // if team subscription, create team
    if (subscriptionData?.team) {
      if (!subscriptionData?.team_members) throw new CodedError("team_members is required", "CNS04")

      // if user is already part of a team, and is also the team owner, update the existing team instead of creating a new one
      if (user?.team_id && user?.role === "TEAMOWNER") {
        subscriptionData.team_id = user?.team_id

        // update team to have new max_users
        const teamRequest = await fetch(process.env.API_URL + "/teams/" + user?.team_id, {
          method: "PUT",
          headers: { "x-api-token": process.env.API_MASTER_TOKEN },
          body: convertToFormata({ max_users: subscriptionData?.team_members }),
        })
        const team = await teamRequest.json()
        if (team?.success !== "success") throw new CodedError(JSON.stringify(team), "CNS07")
      } else {
        const teamRequest = await fetch(process.env.API_URL + "/teams", {
          method: "POST",
          headers: { "x-api-token": process.env.API_MASTER_TOKEN },
          body: convertToFormata({
            teamname: (user?.name || user?.email) + "'s Team",
            max_users: subscriptionData?.team_members,
          }),
        })
        const team = await teamRequest.json()
        if (team?.success !== "success") throw new CodedError(JSON.stringify(team), "CNS05")

        // update user to be team owner and part of new team
        const userRequest = await fetch(process.env.API_URL + "/users/" + user.user_id, {
          method: "PUT",
          headers: { "x-api-token": process.env.API_MASTER_TOKEN },
          body: convertToFormata({
            team_id: team?.data?.team_id,
            role: "TEAMOWNER",
          }),
        })
        const userUpdate = await userRequest.json()
        if (userUpdate?.success !== "success") throw new CodedError(JSON.stringify(userUpdate), "CNS06")

        // update subscription.data.team_id to be team_id of new team
        subscriptionData.team_id = team?.data?.team_id
      }
    }

    const subscription = await Subscription.create({
      user_id: user.user_id,
      subscription_name: product?.dataValues?.product_name,
      product_id: product?.dataValues?.product_id,
      amount: subscriptionData?.renewal_cost,
      duration: subscriptionData?.duration,
      renewal_date: new Date(),
      status: "active",
      data: subscriptionData,
    })
    if (!subscription) throw new CodedError("subscription creation failed", "CNS03")

    // charge the subscription for the first time right away
    await handlePaymentOfSubscription(subscription, user.email, {
      sendCreationEmail: true,
    })

    // log subscription creation
    await Transaction.create({
      user_id: user.user_id,
      type: "subscription",
      memo: "Subscription created",
      data: JSON.stringify(product),
    })

    return { success: "success", data: subscription }
  } catch (error) {
    return { success: "error", error: error.message, code: error.code }
  }
}
