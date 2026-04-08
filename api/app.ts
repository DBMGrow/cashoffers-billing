import "./config/startup"

import { OpenAPIHono } from "@hono/zod-openapi"
import { Scalar } from "@scalar/hono-api-reference"
import { logger as honoLogger } from "hono/logger"
import { cors } from "hono/cors"
import type { HonoVariables } from "./types/hono"

// Import routes (we'll create these next)
import { productRoutes } from "./routes/product/routes"
import { cardRoutes } from "./routes/card/routes"
import { paymentRoutes } from "./routes/payment/routes"
import { subscriptionRoutes } from "./routes/subscription/routes"
import { purchaseRoutes } from "./routes/purchase/routes"
import { propertyRoutes } from "./routes/property/routes"
import { cronRoutes } from "./routes/cron/routes"
import { emailsRoutes } from "./routes/emails/routes"
import { authRoutes } from "./routes/auth/routes"
import { signupRoutes } from "./routes/signup/routes"
import { manageRoutes } from "./routes/manage/routes"
import { testRoutes } from "./routes/test/routes"
import { devRoutes } from "./routes/dev/routes"
import { webhookRoutes } from "./routes/webhooks/routes"
import "./lib/late-handlers"

// Import middleware
import { errorHandler } from "./lib/middleware/errorHandler"
import { digestMiddleware } from "./lib/middleware/digestMiddleware"
import { loggingContextMiddleware } from "./lib/middleware/loggingContextMiddleware"
import { loggingFlushMiddleware } from "./lib/middleware/loggingFlushMiddleware"

// Create OpenAPI Hono app with typed variables
const app = new OpenAPIHono<{ Variables: HonoVariables }>().basePath("/api")

// Global middleware
app.use("*", honoLogger()) // Request logging
app.use("*", cors()) // CORS support
app.use("*", digestMiddleware) // Custom digest middleware - creates requestId
app.use("*", loggingContextMiddleware) // Sets up AsyncLocalStorage for logging
app.use("*", loggingFlushMiddleware) // Flushes logs after response

// Mount routes
app.route("/product", productRoutes)
app.route("/card", cardRoutes)
app.route("/payment", paymentRoutes)
app.route("/subscription", subscriptionRoutes)
app.route("/purchase", purchaseRoutes)
app.route("/property", propertyRoutes)
app.route("/cron", cronRoutes)
app.route("/emails", emailsRoutes)
app.route("/auth", authRoutes)
app.route("/signup", signupRoutes)
app.route("/manage", manageRoutes)
app.route("/test", testRoutes)
app.route("/dev", devRoutes)
app.route("/webhooks", webhookRoutes)

// OpenAPI documentation endpoints
app.doc("/openapi.json", (_c) => ({
  openapi: "3.0.0",
  info: {
    title: "CashOffers Billing API",
    version: "1.0.0",
    description: "Billing and subscription management service for CashOffers with Square payment processing",
  },
  servers: [
    { url: "http://localhost:3000", description: "Development" },
    { url: "https://billing.staging.cashoffers.pro", description: "Staging" },
    { url: "https://billing.cashoffers.pro", description: "Production" },
  ],
}))

// Scalar API documentation
app.get(
  "/docs",
  Scalar({
    url: "/api/openapi.json",
    theme: "fastify",
  })
)

// Health check endpoint (no auth required)
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() })
})

// Error handler (must be last)
app.onError(errorHandler)

// Start server
// const PORT = Number(process.env.PORT) || 3000

// serve(
//   {
//     fetch: app.fetch,
//     port: PORT,
//   },
//   (info) => {
//     console.info(`🚀 Hono server listening on http://localhost:${info.port}`)
//   }
// )

export { app }
