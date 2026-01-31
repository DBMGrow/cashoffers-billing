import { Hono } from "hono"
import type { HonoVariables } from "../../types/hono"
import sequelize from "../../database/database"
import sendEmail from "../../utils/sendEmail"
import { client } from "../../config/square"

const app = new Hono<{ Variables: HonoVariables }>()

app.post("/", async (c) => {
  // Status check for the service
  const body = await c.req.json()
  const { secret } = body

  if (!secret) {
    return c.json({ success: "error", message: "0001A: Unauthorized" })
  }

  if (secret !== process.env.STATUS_CHECK_SECRET) {
    return c.json({ success: "error", message: "0001B: Unauthorized" })
  }

  const status: any = {
    info: "This is the status check for the Square Payments Service.",
  }

  // Check database connection
  try {
    await sequelize.authenticate()
    status.database = "success: connected to " + process.env.DB_NAME + " database"
  } catch (error) {
    status.database = "error"
    console.error("Error connecting to database:", error)
  }

  // Check SendGrid connection
  try {
    const emailSent = await sendEmail({
      to: process.env.ADMIN_EMAIL!,
      from: process.env.SYSTEM_EMAIL!,
      subject: "Square Payments Service SendGrid Status check",
      text: "If you've received this email, SendGrid integration is working.",
    })
    if (!emailSent) throw new Error("Error sending email")
    status.sendgrid =
      "sendGrid is active and sending emails from " +
      process.env.SYSTEM_EMAIL +
      ". You should have received an email at " +
      process.env.ADMIN_EMAIL
  } catch (error) {
    status.sendgrid = "error"
    console.error("Error connecting to sendgrid:", error)
  }

  // Check Square connection
  try {
    const payments = await client.paymentsApi.listPayments()
    if (!payments) throw new Error("Error getting payments")
    status.square = "success"
  } catch (error: any) {
    status.square = { error: error.message }
    console.error("Error connecting to square:", error)
  }

  // Print Square env
  status.square_environment = process.env.SQUARE_ENVIRONMENT

  status.permissions =
    process.env.BYPASS_PERMISSIONS === "true"
      ? "Warning: Bypass permissions is enabled. If this is a production environment, please disable this."
      : "Permissions are enabled."

  status.main_api_url = `This service is integrated into the ${process.env.API_URL || "[Warning: NO API_URL]"} system`

  return c.json(status)
})

export const statusRoutes = app
