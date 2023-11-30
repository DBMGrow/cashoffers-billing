import parseEmailTemplate from "./parseEmailTemplate"
import sgMail from "@sendgrid/mail"
sgMail.setApiKey(process.env.SENDGRID_API_KEY)
import fetch from "node-fetch"

export default async function sendEmail(msg) {
  let { to, from = process.env.SYSTEM_EMAIL, subject, text, html, fields = {}, template = "main.html" } = msg
  msg = {
    to,
    from,
    subject,
    text,
    fields,
    template,
  }

  try {
    if (process.env.SEND_EMAILS === "false") return console.info("Emails are disabled", to, from, subject, text, html)

    let whitelabel = await getWhitelabel(to)
    if (!whitelabel) whitelabel = "CashOffers.PRO"
    msg.html = await parseEmailTemplate(template, { text, whitelabel, subject, ...fields })
    if (!msg.html) msg.html = text

    await sgMail.send(msg)
    console.info("Email sent to " + to)

    return true
  } catch (error) {
    console.error(msg, error)
    return false // error sending email
  }
}

async function getWhitelabel(email) {
  const user = await fetch(`${process.env.API_URL}/users?email=${email}`, {
    method: "GET",
    headers: {
      "x-api-token": process.env.API_MASTER_TOKEN,
    },
  })

  const userData = await user.json()
  if (userData.success === "success") return userData?.data?.[0]?.whitelabel_name
  return null
}
