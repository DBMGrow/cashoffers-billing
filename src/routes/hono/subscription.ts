import { Hono } from "hono"
import type { HonoVariables } from "../../types/hono"
import { authMiddleware } from "../../middleware/hono/authMiddleware"
import { Subscription } from "../../database/Subscription"
import { UserCard } from "../../database/UserCard"
import { Transaction } from "../../database/Transaction"
import toggleSubscription from "../../utils/toggleSubscription"
import sendEmail from "@/utils/sendEmail"
import axios from "axios"

const app = new Hono<{ Variables: HonoVariables }>()

// Get all subscriptions with pagination
app.get("/", authMiddleware("payments_read_all", { allowSelf: true }), async (c) => {
  const query = c.req.query()
  const { page = "1", limit = "20" } = query

  try {
    const pageNum = Number(page)
    const limitNum = Number(limit)

    const subscriptions = await Subscription.findAll({
      order: [["createdAt", "DESC"]],
      limit: limitNum,
      offset: (pageNum - 1) * limitNum,
    })
    const total = await Subscription.count()

    return c.json({
      success: "success",
      data: subscriptions,
      page: pageNum,
      limit: limitNum,
      total,
    })
  } catch (error: any) {
    return c.json({ success: "error", error: error.message })
  }
})

// Get your own subscription
app.get("/single", authMiddleware(null, { allowSelf: true }), async (c) => {
  const user = c.get("user")
  const { user_id } = user

  try {
    const subscription = await Subscription.findOne({ where: { user_id } })
    return c.json({ success: "success", data: [subscription] })
  } catch (error: any) {
    return c.json({ success: "error", error: error.message })
  }
})

// Create or update subscription
app.post("/", authMiddleware("payments_create"), async (c) => {
  const body = await c.req.json()
  const { user_id, subscription_name, amount, duration } = body

  try {
    if (!user_id) throw new Error("user_id is required")
    if (!subscription_name) throw new Error("subscription_name is required")
    if (!amount) throw new Error("amount is required")
    if (!duration) throw new Error("duration is required")

    // Check if user has a card
    const userCard = await UserCard.findOne({ where: { user_id } })
    if (!userCard) throw new Error("User does not have a card on file")

    // Check if subscription exists
    const existingSubscription = await Subscription.findOne({ where: { user_id } })

    if (existingSubscription) {
      // Update existing subscription
      await existingSubscription.update({
        subscription_name,
        amount,
        duration,
      })

      await Transaction.create({
        user_id,
        amount: 0,
        type: "subscription",
        memo: subscription_name + " updated",
        data: JSON.stringify({ subscription_name, amount, duration }),
      })

      return c.json({ success: "success", data: existingSubscription })
    } else {
      // Create new subscription
      const subscription = await Subscription.create({
        user_id,
        subscription_name,
        amount,
        duration,
        status: "active",
      })

      await Transaction.create({
        user_id,
        amount: 0,
        type: "subscription",
        memo: subscription_name + " created",
        data: JSON.stringify({ subscription_name, amount, duration }),
      })

      return c.json({ success: "success", data: subscription })
    }
  } catch (error: any) {
    await Transaction.create({
      user_id: body.user_id,
      amount: 0,
      type: "subscription",
      memo: "subscription operation failed",
      data: error.message,
    })
    return c.json({ success: "error", error: error.message, body })
  }
})

// Update subscription
app.put("/", authMiddleware("payments_create"), async (c) => {
  const body = await c.req.json()
  const { user_id, subscription_name, amount, duration, status } = body

  try {
    const updateBody: any = {}
    if (subscription_name) updateBody.subscription_name = subscription_name
    if (amount) updateBody.amount = amount
    if (duration) updateBody.duration = duration
    if (status) updateBody.status = status

    await Subscription.update(updateBody, { where: { user_id } })

    await Transaction.create({
      user_id,
      amount: 0,
      type: "subscription",
      memo: subscription_name + " updated",
      data: JSON.stringify(updateBody),
    })

    return c.json({ success: "success", data: updateBody })
  } catch (error: any) {
    await Transaction.create({
      user_id,
      amount: 0,
      type: "subscription",
      memo: subscription_name + " failed to update",
      data: error.message,
    })
    return c.json({ success: "error", error: error.message, body })
  }
})

// Delete (deactivate) subscription
app.delete("/", authMiddleware("payments_delete"), async (c) => {
  const body = await c.req.json()
  const { user_id } = body

  try {
    if (!user_id) throw new Error("user_id is required")

    await Subscription.update({ status: "inactive" }, { where: { user_id } })

    return c.json({ success: "success", data: { user_id, status: "inactive" } })
  } catch (error: any) {
    return c.json({ success: "error", error: error.message })
  }
})

// Pause subscription
app.post(
  "/pause/:subscription_id",
  authMiddleware("payments_create", { allowSelf: true }),
  async (c) => {
    const { subscription_id } = c.req.param()

    try {
      if (!subscription_id) throw new Error("subscription_id is required")

      // Create mock request for toggleSubscription compatibility
      const mockReq = { params: { subscription_id } }
      const result = await toggleSubscription(mockReq as any, "pause")

      return c.json(result)
    } catch (error: any) {
      return c.json({ success: "error", error: error.message })
    }
  }
)

// Resume subscription
app.post(
  "/resume/:subscription_id",
  authMiddleware("payments_create", { allowSelf: true }),
  async (c) => {
    const { subscription_id } = c.req.param()

    try {
      if (!subscription_id) throw new Error("subscription_id is required")

      await Subscription.update({ status: "active" }, { where: { subscription_id } })

      return c.json({ success: "success", data: { subscription_id, status: "active" } })
    } catch (error: any) {
      return c.json({ success: "error", error: error.message })
    }
  }
)

// Cancel subscription (mark for cancellation on renewal)
app.post("/cancel/:subscription_id", async (c) => {
  const { subscription_id } = c.req.param()

  try {
    if (!subscription_id) throw new Error("subscription_id is required")

    const subscription = await Subscription.findOne({ where: { subscription_id } })
    if (!subscription) throw new Error("Subscription not found")

    // Custom auth: check if user owns subscription or has payments_create permission
    const user = c.get("user")
    const tokenOwner = c.get("token_owner")
    const tokenOwnerCaps = tokenOwner?.capabilities || []

    const isOwner = user?.user_id === subscription.dataValues.user_id
    const hasPermission = tokenOwnerCaps.includes("payments_create")

    if (!isOwner && !hasPermission) {
      return c.json({ success: "error", error: "Unauthorized" })
    }

    await subscription.update({ cancel_on_renewal: true })

    // Send email notification (async, don't wait)
    const userResponse = await axios.get(
      `${process.env.API_URL}/users/${subscription.dataValues.user_id}`,
      {
        headers: { "x-api-token": process.env.API_MASTER_TOKEN },
      }
    )

    sendEmail({
      to: "annette@remrktco.com",
      subject: "User Subscription Cancellation",
      template: "subscriptionCancelled.html",
      fields: {
        name: userResponse.data?.data?.name || "Unknown",
        email: userResponse.data?.data?.email || "Unknown",
      },
    }).catch((err) => console.error("Email send error:", err))

    return c.json({ success: "success", data: subscription })
  } catch (error: any) {
    return c.json({ success: "error", error: error.message })
  }
})

// Uncancel subscription
app.post("/uncancel/:subscription_id", async (c) => {
  const { subscription_id } = c.req.param()

  try {
    if (!subscription_id) throw new Error("subscription_id is required")

    const subscription = await Subscription.findOne({ where: { subscription_id } })
    if (!subscription) throw new Error("Subscription not found")

    // Same auth check as cancel
    const user = c.get("user")
    const tokenOwner = c.get("token_owner")
    const tokenOwnerCaps = tokenOwner?.capabilities || []

    const isOwner = user?.user_id === subscription.dataValues.user_id
    const hasPermission = tokenOwnerCaps.includes("payments_create")

    if (!isOwner && !hasPermission) {
      return c.json({ success: "error", error: "Unauthorized" })
    }

    await subscription.update({ cancel_on_renewal: false })

    return c.json({ success: "success", data: subscription })
  } catch (error: any) {
    return c.json({ success: "error", error: error.message })
  }
})

// Downgrade subscription (mark for downgrade on renewal)
app.post("/downgrade/:subscription_id", async (c) => {
  const { subscription_id } = c.req.param()

  try {
    if (!subscription_id) throw new Error("subscription_id is required")

    const subscription = await Subscription.findOne({ where: { subscription_id } })
    if (!subscription) throw new Error("Subscription not found")

    // Custom auth check
    const user = c.get("user")
    const tokenOwner = c.get("token_owner")
    const tokenOwnerCaps = tokenOwner?.capabilities || []

    const isOwner = user?.user_id === subscription.dataValues.user_id
    const hasPermission = tokenOwnerCaps.includes("payments_create")

    if (!isOwner && !hasPermission) {
      return c.json({ success: "error", error: "Unauthorized" })
    }

    await subscription.update({ downgrade_on_renewal: true })

    // Send email notification
    const userResponse = await axios.get(
      `${process.env.API_URL}/users/${subscription.dataValues.user_id}`,
      {
        headers: { "x-api-token": process.env.API_MASTER_TOKEN },
      }
    )

    sendEmail({
      to: "annette@remrktco.com",
      subject: "User Subscription Downgrade",
      template: "subscriptionDowngraded.html",
      fields: {
        name: userResponse.data?.data?.name || "Unknown",
        email: userResponse.data?.data?.email || "Unknown",
      },
    }).catch((err) => console.error("Email send error:", err))

    return c.json({ success: "success", data: subscription })
  } catch (error: any) {
    return c.json({ success: "error", error: error.message })
  }
})

// Undowngrade subscription
app.post("/undowngrade/:subscription_id", async (c) => {
  const { subscription_id } = c.req.param()

  try {
    if (!subscription_id) throw new Error("subscription_id is required")

    const subscription = await Subscription.findOne({ where: { subscription_id } })
    if (!subscription) throw new Error("Subscription not found")

    // Same auth check
    const user = c.get("user")
    const tokenOwner = c.get("token_owner")
    const tokenOwnerCaps = tokenOwner?.capabilities || []

    const isOwner = user?.user_id === subscription.dataValues.user_id
    const hasPermission = tokenOwnerCaps.includes("payments_create")

    if (!isOwner && !hasPermission) {
      return c.json({ success: "error", error: "Unauthorized" })
    }

    await subscription.update({ downgrade_on_renewal: false })

    return c.json({ success: "success", data: subscription })
  } catch (error: any) {
    return c.json({ success: "error", error: error.message })
  }
})

export const subscriptionRoutes = app
