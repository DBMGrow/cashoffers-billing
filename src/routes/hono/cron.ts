import { Hono } from "hono"
import type { HonoVariables } from "../../types/hono"
import subscriptionsCron from "../../cron/subscriptionsCron"
import suspendSubscriptionsCron from "../../cron/suspendSubscriptionsCron"

const app = new Hono<{ Variables: HonoVariables }>()

// Run cron jobs
app.post("/", async (c) => {
  const body = await c.req.json()
  const { secret } = body

  if (secret !== process.env.CRON_SECRET) {
    throw new Error("Unauthorized")
  }

  await subscriptionsCron()
  await suspendSubscriptionsCron()

  return c.json({ success: "success", message: "Cron job running" })
})

export const cronRoutes = app
