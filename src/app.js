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
import emailRoutes from "./routes/email"
import statusRoutes from "./routes/status"
import cronRoutes from "./routes/cron"

app.use(json()) // middleware to parse json data

app.use("/", baseRoutes)
app.use("/payment", paymentRoutes)
app.use("/card", cardRoutes)
app.use("/subscription", subscriptionRoutes)
app.use("/email", emailRoutes)
app.use("/cron", cronRoutes)
app.use("/status", statusRoutes)

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
