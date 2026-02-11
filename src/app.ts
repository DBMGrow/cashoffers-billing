import "dotenv/config"
import "./config/startup"

import { serve } from "@hono/node-server"
import { Hono } from "hono"
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

// Import middleware
import { errorHandler } from "./middleware/errorHandler"
import { digestMiddleware } from "./middleware/digestMiddleware"

// Create Hono app with typed variables
const app = new Hono<{ Variables: HonoVariables }>()

// Global middleware
app.use("*", honoLogger()) // Request logging
app.use("*", cors()) // CORS support
app.use("*", digestMiddleware) // Custom digest middleware

// Mount routes
app.route("/product", productRoutes)
app.route("/card", cardRoutes)
app.route("/payment", paymentRoutes)
app.route("/subscription", subscriptionRoutes)
app.route("/purchase", purchaseRoutes)
app.route("/property", propertyRoutes)
app.route("/cron", cronRoutes)
app.route("/emails", emailsRoutes)

// Error handler (must be last)
app.onError(errorHandler)

// Start server
const PORT = Number(process.env.PORT) || 3000

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.info(`🚀 Hono server listening on http://localhost:${info.port}`)
  }
)

export { app }
