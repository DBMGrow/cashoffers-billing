import "dotenv/config"
import "./config/startup"
import "express-async-errors"

import Express, { json } from "express"
import sequelize from "./database/database"
import cookieParser from "cookie-parser"

const app = Express()
const PORT = process.env.PORT || 3000

app.use(json())
app.use(cookieParser())

import paymentRoutes from "./routes/payment"
import cardRoutes from "./routes/card"
import subscriptionRoutes from "./routes/subscription"
import productRoutes from "./routes/product"
import purchaseRoutes from "./routes/purchase"
import statusRoutes from "./routes/status"
import cronRoutes from "./routes/cron"
import errorHandler from "./middleware/errorHandler"

app.use("/payment", paymentRoutes)
app.use("/card", cardRoutes)
app.use("/subscription", subscriptionRoutes)
app.use("/product", productRoutes)
app.use("/purchase", purchaseRoutes)
app.use("/status", statusRoutes)
app.use("/cron", cronRoutes)

app.use(errorHandler)

app.listen(PORT, async () => {
  console.info(`App listening at port ${PORT}`)
  try {
    await sequelize.sync()
    console.info("Database synced")
  } catch (error) {
    console.error("Error syncing database:", error)
  }
})
