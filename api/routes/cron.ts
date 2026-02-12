import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import subscriptionsCron from "@api/cron/subscriptionsCron"
import { RunCronRoute, SendHealthReportRoute } from "./schemas/cron.schemas"
import { getContainer } from "@api/container"
// TODO: suspendSubscriptionsCron doesn't exist yet - need to implement or remove
// import suspendSubscriptionsCron from "@api/cron/suspendSubscriptionsCron"

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

// Send daily health report
app.openapi(SendHealthReportRoute, async (c) => {
  const body = c.req.valid("json")
  const { secret, date } = body

  if (secret !== process.env.CRON_SECRET) {
    throw new Error("Unauthorized")
  }

  const container = getContainer()
  const healthReportService = container.services.healthReport
  const config = container.config

  // Parse date if provided
  const reportDate = date ? new Date(date) : new Date()

  // Send to dev email (primary) and admin email (fallback)
  const recipients: string[] = []
  if (config.email.devEmail) {
    recipients.push(config.email.devEmail)
  }
  if (config.email.adminEmail && config.email.adminEmail !== config.email.devEmail) {
    recipients.push(config.email.adminEmail)
  }

  // Ensure we have at least one recipient
  if (recipients.length === 0) {
    throw new Error('No email recipients configured for health reports')
  }

  await healthReportService.sendDailyHealthReport(recipients, reportDate)

  return c.json({
    success: "success" as const,
    message: "Daily health report sent successfully",
    reportDate: reportDate.toISOString(),
    recipientCount: recipients.length,
  }, 200)
})

export const cronRoutes = app
