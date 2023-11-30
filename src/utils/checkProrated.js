import { Subscription } from "../database/Subscription"
import { Product } from "../database/Product"

export default async function checkProrated(req) {
  const { product_id, user_id } = req.body

  if (!product_id) throw new Error("product_id is required")
  if (!user_id) throw new Error("user_id is required")

  // Get the product
  const product = await Product.findOne({ where: { product_id } })
  if (!product) throw new Error("product not found")

  // Get the user's subscription
  const subscription = await Subscription.findOne({ where: { user_id } })
  if (!subscription) throw new Error("subscription not found")

  const currentPlanCost = subscription.dataValues?.data?.renewal_cost
  const newPlanCost = product.dataValues?.data?.renewal_cost

  if (!currentPlanCost) throw new Error("currentPlanCost not found")
  if (!newPlanCost) throw new Error("newPlanCost not found")

  const renewalDate = new Date(subscription.dataValues.renewal_date)
  const duration = subscription.dataValues.duration

  if (!renewalDate) throw new Error("renewalDate not found")
  if (!duration) throw new Error("duration not found")

  //calculate startDate based on renewalDate and duration
  const startDate = new Date(renewalDate)
  if (duration === "daily") startDate.setDate(startDate.getDate() - 1)
  if (duration === "weekly") startDate.setDate(startDate.getDate() - 7)
  if (duration === "monthly") startDate.setMonth(startDate.getMonth() - 1)
  if (duration === "yearly") startDate.setFullYear(startDate.getFullYear() - 1)

  const totalDuration = Math.abs(renewalDate - startDate) / 1000 / 60 / 60 / 24
  const timeRemaining = Math.abs(renewalDate - new Date()) / 1000 / 60 / 60 / 24

  const percentOfTimeRemaining = timeRemaining / totalDuration
  const totalSubscriptionCostDifference = newPlanCost - currentPlanCost

  // we're not setting a negative prorated amount
  const proratedAmount = Math.floor(Math.max(0, totalSubscriptionCostDifference * percentOfTimeRemaining))

  return {
    proratedAmount,
    startDate,
    renewalDate,
    duration,
    currentPlanCost,
    newPlanCost,
    totalDuration,
    timeRemaining,
    percentOfTimeRemaining,
    totalSubscriptionCostDifference,
  }
}
