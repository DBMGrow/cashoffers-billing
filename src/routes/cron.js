import express from "express"
import subscriptionsCron from "../cron/subscriptionsCron"
import scheduleCron from "../utils/scheduleCron"

const router = express.Router()

scheduleCron("0 * * * *", "/cron") // run cron every hour

router.post("/", async (req, res) => {
  const { secret } = req.body
  try {
    if (secret !== process.env.CRON_SECRET) throw new Error("Unauthorized")

    await subscriptionsCron()

    res.json({ success: "success", message: "Cron job running" })
  } catch (error) {
    res.json({ success: "error", error: error.message })
  }
})

const cronRoutes = router
export default cronRoutes
