import { createHmac, timingSafeEqual } from "crypto"
import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import { config } from "@api/config/config.service"
import { logger, eventBus, userApiClient } from "@api/lib/services"
import { subscriptionRepository } from "@api/lib/repositories"
import { CashOffersWebhookHandler } from "@api/application/webhook-handlers/cashoffers-webhook.handler"
import { CashOffersWebhookRoute } from "./schemas"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

const webhookHandler = new CashOffersWebhookHandler({
  logger,
  userApiClient,
  subscriptionRepository,
  eventBus,
})

/**
 * Verify HMAC-SHA256 signature from X-Webhook-Signature header.
 * Returns true if no webhookSecret is configured (open for dev/test).
 */
function verifySignature(body: string, signature: string | undefined): boolean {
  if (!config.webhookSecret) return true
  if (!signature) return false

  const expected = createHmac("sha256", config.webhookSecret).update(body).digest("hex")
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

app.openapi(CashOffersWebhookRoute, async (c) => {
  const rawBody = await c.req.text()
  const signature = c.req.header("x-webhook-signature")

  if (!verifySignature(rawBody, signature)) {
    return c.json({ success: "error" as const, error: "Invalid webhook signature" }, 401)
  }

  let body: { type: string; userId: number }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return c.json({ success: "error" as const, error: "Invalid JSON body" }, 400)
  }

  await webhookHandler.handle(body as any)

  return c.json({ success: "success" as const, data: { received: true } })
})

export const webhookRoutes = app
