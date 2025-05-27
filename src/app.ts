import "dotenv/config"
import "./lib/startup"

import Express, { json, Request, Response } from "express"
import sequelize from "./database/database"
import cookieParser from "cookie-parser"
import helmet from "helmet"
import moduleAlias from "module-alias"

moduleAlias.addAliases({ "@": __dirname })

import "express-async-errors"

const app = Express()
const PORT = process.env.PORT || 3000

app.use(json())
app.use(cookieParser())
app.use(helmet({}))

import paymentRoutes from "@/modules/payment/payment"
import cardRoutes from "@/modules/card/card.routes"
import subscriptionRoutes from "@/modules/subscription"
import productRoutes from "@/modules/product/product"
import purchaseRoutes from "@/modules/purchase/purchase.routes"
import emailRoutes from "@/modules/email"
import statusRoutes from "@/modules/system/status/status"
import cronRoutes from "@/modules/system/cron"
import logRoutes from "@/modules/log"

app.use("/payment", paymentRoutes)
app.use("/card", cardRoutes)
app.use("/subscription", subscriptionRoutes)
app.use("/product", productRoutes)
app.use("/purchase", purchaseRoutes)
app.use("/email", emailRoutes)
app.use("/status", statusRoutes)
app.use("/cron", cronRoutes)
app.use("/log", logRoutes)

app.use((err: any, req: Request, res: Response) => {
  console.error(err.stack)
  res.status(500).json({ success: "error", message: err.message })
})

app.listen(PORT, async () => {
  console.info(`App listening at port ${PORT}`)
  try {
    await sequelize.sync()
    console.info("Database synced")
  } catch (error) {
    console.error("Error syncing database:", error)
  }
})
