import express from "express"
import sequelize from "../database/database"
import sendEmail from "../utils/sendEmail"
import { client } from "../config/square"

const router = express.Router()

router.post("/", async (req, res) => {
  //status check for the service
  const { secret } = req.body

  if (!secret) return res.json({ success: "error", message: "0001A: Unauthorized" })
  if (secret !== process.env.STATUS_CHECK_SECRET) return res.json({ success: "error", message: "0001B: Unauthorized" })

  const status = {
    info: "This is the status check for the Square Payments Service.",
  }

  //check database connection
  try {
    await sequelize.authenticate()
    status.database = "success: connected to " + process.env.DB_NAME + " database"
  } catch (error) {
    status.database = "error"
    console.error("Error connecting to database:", error)
  }

  //check sendgrid connection
  try {
    if (
      !sendEmail({
        to: process.env.ADMIN_EMAIL,
        from: process.env.SYSTEM_EMAIL,
        subject: "Square Payments Service SendGrid Status check",
        text: "If you've received this email, SendGrid integration is working.",
      })
    ) {
      throw new Error("Error sending email")
    }
    status.sendgrid =
      "sendGrid is active and sending emails from " +
      process.env.SYSTEM_EMAIL +
      ". You should have received an email at " +
      process.env.ADMIN_EMAIL
  } catch (error) {
    status.sendgrid = "error"
    console.error("Error connecting to sendgrid:", error)
  }

  //check square connection
  try {
    const payments = await client.paymentsApi.listPayments()
    if (!payments) throw new Error("Error getting payments")
    console.log("Square payments:", payments)
    status.square = "success"
  } catch (error) {
    status.square = { error: error.message }
    console.error("Error connecting to square:", error)
  }

  //print square env
  status.square_environment = process.env.SQUARE_ENVIRONMENT

  status.permissions =
    process.env.BYPASS_PERMISSIONS === "true"
      ? "Warning: Bypass permissions is enabled. If this is a production environment, please disable this."
      : "Permissions are enabled."

  status.main_api_url = `This service is integrated into the ${process.env.API_URL || "[Warning: NO API_URL]"} system`

  status.cron =
    process.env.CRON_ACTIVE === "true"
      ? "Cron system is active"
      : "The cron system is inactive and will only run when triggered manually."

  res.json(status)
})

const statusRoutes = router
export default statusRoutes
