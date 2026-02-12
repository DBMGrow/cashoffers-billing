import "dotenv/config"
import "./config/startup"

import { serve } from "@hono/node-server"
import { OpenAPIHono } from "@hono/zod-openapi"
import { Scalar } from "@scalar/hono-api-reference"
import { logger as honoLogger } from "hono/logger"
import { cors } from "hono/cors"
import type { HonoVariables } from "./types/hono"

// Import routes (we'll create these next)
import { productRoutes } from "./routes/product"
import { cardRoutes } from "./routes/card"
import { paymentRoutes } from "./routes/payment"
import { subscriptionRoutes } from "./routes/subscription"
import { purchaseRoutes } from "./routes/purchase"
import { propertyRoutes } from "./routes/property"
import { cronRoutes } from "./routes/cron"
import { emailsRoutes } from "./routes/emails"
import { authRoutes } from "./routes/auth"
import { signupRoutes } from "./routes/signup"
import { manageRoutes } from "./routes/manage"

// Import middleware
import { errorHandler } from "./middleware/errorHandler"
import { digestMiddleware } from "./middleware/digestMiddleware"
import { loggingContextMiddleware } from "./middleware/loggingContextMiddleware"
import { loggingFlushMiddleware } from "./middleware/loggingFlushMiddleware"

// Create OpenAPI Hono app with typed variables
const app = new OpenAPIHono<{ Variables: HonoVariables }>()

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

// OpenAPI documentation endpoints
app.doc("/openapi.json", (c) => ({
  openapi: "3.0.0",
  info: {
    title: "CashOffers Billing API",
    version: "1.0.0",
    description: "Billing and subscription management service for CashOffers with Square payment processing",
  },
  servers: [
    { url: "http://localhost:3000", description: "Development" },
    { url: "https://billing-api.cashoffers.com", description: "Production" },
  ],
}))

// Scalar API documentation
app.get(
  "/docs",
  Scalar({
    url: "/openapi.json",
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
