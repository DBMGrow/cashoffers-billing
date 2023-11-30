import { Subscription } from "../database/Subscription"
import fetch from "node-fetch"
import convertToFormata from "./convertToFormdata"
import CodedError from "../config/CodedError"

export default async function toggleSubscription(subscription_id, options) {
  const { scramble = false, status = "pause" } = options || {}

  let active
  switch (status) {
    case "pause":
    case "suspend":
    case "cancel":
      active = 0
      break
    case "active":
      active = 1
      break
  }

  if (typeof active === "undefined") throw new CodedError("Invalid status", "TS00")

  function scrambleEmail(email) {
    return "cancelled" + email.split("@")[0] + "+" + Math.floor(Math.random() * 100000) + "@" + email.split("@")[1]
  }

  const subscription = await Subscription.findOne({ where: { subscription_id } })
  if (!subscription) throw new CodedError("Subscription not found", "TS01")

  if (active) {
    // when resuming a subscription, update the renewal based on suspension_date
    const suspension_date = subscription?.dataValues?.suspension_date
    if (suspension_date) {
      // check how many days have passed since suspension
      const daysSinceSuspension = Math.floor((new Date() - new Date(suspension_date)) / (1000 * 60 * 60 * 24))
      // update renewal_date based on days since suspension
      const renewal_date = new Date(
        new Date(subscription?.dataValues?.renewal_date).getTime() + daysSinceSuspension * 24 * 60 * 60 * 1000
      )
      await subscription.update({ renewal_date })
    }
  } else {
    // when suspending a subscription, update the suspension_date
    await subscription.update({ suspension_date: new Date() })
  }

  // if the subscription has a team id, deactivate the members on the team
  const team_id = subscription?.dataValues?.data?.team_id
  if (team_id) {
    const teamMembers = await fetch(process.env.API_URL + "/users?team_id=" + team_id, {
      method: "GET",
      headers: { "x-api-token": process.env.API_MASTER_TOKEN },
    })
    const teamMembersResponse = await teamMembers.json()
    if (teamMembersResponse?.success !== "success") throw new CodedError("TS02: Error fetching team members", "TS02")

    teamMembersResponse?.data?.forEach(async (member) => {
      const body = { active }
      if (scramble) body.email = scrambleEmail(member?.email)
      const deactivateMember = await fetch(process.env.API_URL + "/users/" + member?.user_id, {
        method: "PUT",
        headers: { "x-api-token": process.env.API_MASTER_TOKEN },
        body: convertToFormata(body),
      })
      const deactivateMemberResponse = await deactivateMember.json()
      if (deactivateMemberResponse?.success !== "success")
        throw new CodedError("Error deactivating team member", "TS03")
    })
  } else {
    // fetch the user
    const user = await fetch(process.env.API_URL + "/users/" + subscription?.dataValues?.user_id, {
      method: "GET",
      headers: { "x-api-token": process.env.API_MASTER_TOKEN },
    })
    const userResponse = await user.json()

    // check for scramble
    const body = { active }
    if (scramble) body.email = scrambleEmail(userResponse?.data?.email)

    // deactivate the user
    const deactivateUser = await fetch(process.env.API_URL + "/users/" + subscription?.dataValues?.user_id, {
      method: "PUT",
      headers: { "x-api-token": process.env.API_MASTER_TOKEN },
      body: convertToFormata(body),
    })
    const deactivateUserResponse = await deactivateUser.json()
    if (deactivateUserResponse?.success !== "success") throw new CodedError("Error deactivating user", "TS04")
  }

  await subscription.update({ status })
}
