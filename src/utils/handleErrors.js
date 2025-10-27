import sendEmail from "./sendEmail"
import fetch from "node-fetch"
import convertToFormata from "./convertToFormdata"
import CodedError from "./CodedError"
import { Transaction } from "../database/Transaction"
import { UserCard } from "../database/UserCard"

export default async function handleErrors(req, res, error) {
  function errorIncludesAction(actionName) {
    const actions = error?.data?.actions
    if (typeof actions === "string") return actions === actionName
    if (typeof actions === "object") {
      if (!Array.isArray(actions)) throw new Error("invalid error.data.action for CodedError: " + error.code)
      return actions.includes(actionName)
    }
    return false
  }

  try {
    if (error instanceof CodedError) {
      if (errorIncludesAction("emailAdmin")) {
        sendEmail({
          to: process.env.ADMIN_EMAIL,
          subject: "Error: " + error.code,
          text: error.message,
        })
      }
      if (errorIncludesAction("emailUser")) {
        console.warn("emailing user is not set up yet")
      }
      if (errorIncludesAction("removeNewUser") && error.data?.remove && error.data?.user_id) {
        // used when an error occurred after the user was created, so we need to remove them from the database
        const response = await fetch(process.env.API_URL + "/users/" + error.data.user_id, {
          method: "PUT",
          headers: { "x-api-token": process.env.API_MASTER_TOKEN },
          body: convertToFormata({
            email: "deleted-" + Math.random().toString(36).substring(7) + "-@gmail.com",
          }), //scrambles the email
        })
        const json = await response.json()

        // remove card from database
        const userCard = await UserCard.findOne({ where: { user_id: error.data.user_id } })
        if (userCard) await userCard.destroy()
      }
      if (errorIncludesAction("log")) {
        Transaction.create({
          user_id: 0,
          type: "error",
          data: JSON.stringify({ ...error?.data, ...error.stack }),
          memo: error.message,
          status: "error",
        })
      }
      return res.json({ success: "error", error: error.message, code: error.code })
    }

    // if it is not a CodedError, log it and email admin
    Transaction.create({
      user_id: 0,
      type: "error",
      data: JSON.stringify(error.stack),
      memo: error.message,
      status: "error",
    })

    sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: "Error: " + error.code,
      text: error.message,
    })

    return res.json({ success: "error", error: error.message })
  } catch (error) {
    // because it is possible for there to be an error in the error catching system lol
    return res.json({ success: "error", error: error.message })
  }
}
