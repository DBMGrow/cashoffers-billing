import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@/types/hono"
import subscriptionsCron from "@/cron/subscriptionsCron"
import { RunCronRoute } from "./schemas/cron.schemas"
// TODO: suspendSubscriptionsCron doesn't exist yet - need to implement or remove
// import suspendSubscriptionsCron from "@/cron/suspendSubscriptionsCron"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

// Run cron jobs
app.openapi(RunCronRoute, async (c) => {
  const body = c.req.valid("json")
  const { secret } = body

  if (secret !== process.env.CRON_SECRET) {
    throw new Error("Unauthorized")
  }

  await subscriptionsCron()
  // await suspendSubscriptionsCron() // TODO: implement this function

  return c.json({ success: "success" as const, message: "Cron job running" }, 200)
})

export const cronRoutes = app
