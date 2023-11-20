import "dotenv/config"
import "./config/startup"

import Express, { json } from "express"
import sequelize from "./database/database"

const app = Express()
const PORT = process.env.PORT || 3000

import baseRoutes from "./routes/base"
import paymentRoutes from "./routes/payment"
import cardRoutes from "./routes/card"
import subscriptionRoutes from "./routes/subscription"
import productRoutes from "./routes/product"
import purchaseRoutes from "./routes/purchase"
import emailRoutes from "./routes/email"
import statusRoutes from "./routes/status"
import cronRoutes from "./routes/cron"
import logRoutes from "./routes/log"

app.use(json()) // middleware to parse json data

app.use("/", baseRoutes)
app.use("/payment", paymentRoutes)
app.use("/card", cardRoutes)
app.use("/subscription", subscriptionRoutes)
app.use("/product", productRoutes)
app.use("/purchase", purchaseRoutes)
app.use("/email", emailRoutes)
app.use("/status", statusRoutes)
app.use("/cron", cronRoutes)
app.use("/log", logRoutes)

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ success: "error", message: err.message })
})

app.listen(PORT, async () => {
  console.log(`App listening at port ${PORT}`)
  try {
    await sequelize.sync()
    console.log("Database synced")
  } catch (error) {
    console.error("Error syncing database:", error)
  }
})
