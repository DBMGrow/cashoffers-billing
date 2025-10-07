import express from "express"
import subscriptionsCron from "../cron/subscriptionsCron"
import suspendSubscriptionsCron from "../cron/suspendSubscriptionsCron"

const router = express.Router()

router.post("/", async (req, res) => {
  const { secret } = req.body

  if (secret !== process.env.CRON_SECRET) throw new Error("Unauthorized")

  await subscriptionsCron()
  await suspendSubscriptionsCron()

  res.json({ success: "success", message: "Cron job running" })
})

const cronRoutes = router
export default cronRoutes
