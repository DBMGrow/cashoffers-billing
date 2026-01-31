import { Hono } from "hono"
import type { HonoVariables } from "../../types/hono"
import { authMiddleware } from "../../middleware/hono/authMiddleware"
import { getContainer } from "@/container"
import { executeUseCase } from "./helpers/use-case-handler"

const app = new Hono<{ Variables: HonoVariables }>()

// Get all subscriptions with pagination
app.get("/", authMiddleware("payments_read_all", { allowSelf: true }), async (c) => {
  const query = c.req.query()
  const { page = "1", limit = "20" } = query

  const container = getContainer()

  return executeUseCase(c, () =>
    container.useCases.getSubscriptions.execute({
      page: Number(page),
      limit: Number(limit),
    })
  )
})

// Get your own subscription
app.get("/single", authMiddleware(null, { allowSelf: true }), async (c) => {
  const user = c.get("user")
  const { user_id } = user

  const container = getContainer()

  return executeUseCase(c, () =>
    container.useCases.getSubscriptions.execute({
      userId: user_id,
      page: 1,
      limit: 1,
    })
  )
})

// Create or update subscription
app.post("/", authMiddleware("payments_create"), async (c) => {
  const body = await c.req.json()
  const { user_id, subscription_name, amount, duration, product_id, signup_fee } = body

  if (!user_id) {
    return c.json({ success: "error", error: "user_id is required" }, 400)
  }

  const container = getContainer()

  // Check if subscription exists
  const existingResult = await container.useCases.getSubscriptions.execute({ userId: user_id })

  const existingSubscription =
    existingResult.success && existingResult.data.subscriptions.length > 0
      ? existingResult.data.subscriptions[0]
      : null

  if (existingSubscription) {
    // Update existing subscription (direct repository update for now)
    const updates: any = {}
    if (subscription_name) updates.subscription_name = subscription_name
    if (amount) updates.amount = amount
    if (duration) updates.duration = duration

    await container.repositories.subscription.update(existingSubscription.subscriptionId, {
      ...updates,
      updatedAt: new Date(),
    })

    const now = new Date()
    await container.repositories.transaction.create({
      user_id,
      amount: 0,
      type: "subscription",
      memo: subscription_name + " updated",
      data: JSON.stringify(updates),
      createdAt: now,
      updatedAt: now,
    })

    return c.json({ success: "success", data: existingSubscription })
  }

  // Create new subscription using use case
  const user = c.get("user")
  const email = user?.email || body.email || ""

  return executeUseCase(c, () =>
    container.useCases.createSubscription.execute({
      userId: user_id,
      productId: product_id || subscription_name,
      email,
      userAlreadyExists: true,
      waiveSignupFee: signup_fee === 0,
    })
  )
})

// Update subscription
app.put("/", authMiddleware("payments_create"), async (c) => {
  const body = await c.req.json()
  const { user_id, subscription_name, amount, duration, status } = body

  const container = getContainer()

  // Find user's subscription
  const subscriptions = await container.repositories.subscription.findByUserId(user_id)
  if (subscriptions.length === 0) {
    return c.json({ success: "error", error: "No subscription found for user" }, 404)
  }

  const subscription = subscriptions[0]

  const updateBody: any = {}
  if (subscription_name) updateBody.subscription_name = subscription_name
  if (amount) updateBody.amount = amount
  if (duration) updateBody.duration = duration
  if (status) updateBody.status = status

  await container.repositories.subscription.update(subscription.subscription_id, {
    ...updateBody,
    updatedAt: new Date(),
  })

  const now = new Date()
  await container.repositories.transaction.create({
    user_id,
    amount: 0,
    type: "subscription",
    memo: subscription_name + " updated",
    data: JSON.stringify(updateBody),
    createdAt: now,
    updatedAt: now,
  })

  return c.json({ success: "success", data: updateBody })
})

// Delete (deactivate) subscription
app.delete("/", authMiddleware("payments_delete"), async (c) => {
  const body = await c.req.json()
  const { user_id } = body

  if (!user_id) {
    return c.json({ success: "error", error: "user_id is required" }, 400)
  }

  const container = getContainer()

  // Find user's subscription
  const subscriptions = await container.repositories.subscription.findByUserId(user_id)
  if (subscriptions.length === 0) {
    return c.json({ success: "error", error: "No subscription found for user" }, 404)
  }

  const subscription = subscriptions[0]

  await container.repositories.subscription.update(subscription.subscription_id, {
    status: "inactive",
    updatedAt: new Date(),
  })

  return c.json({ success: "success", data: { user_id, status: "inactive" } })
})

// Pause subscription
app.post(
  "/pause/:subscription_id",
  authMiddleware("payments_create", { allowSelf: true }),
  async (c) => {
    const { subscription_id } = c.req.param()

    if (!subscription_id) {
      return c.json({ success: "error", error: "subscription_id is required" }, 400)
    }

    const container = getContainer()

    return executeUseCase(c, () =>
      container.useCases.pauseSubscription.execute({
        subscriptionId: Number(subscription_id),
      })
    )
  }
)

// Resume subscription
app.post(
  "/resume/:subscription_id",
  authMiddleware("payments_create", { allowSelf: true }),
  async (c) => {
    const { subscription_id } = c.req.param()

    if (!subscription_id) {
      return c.json({ success: "error", error: "subscription_id is required" }, 400)
    }

    const container = getContainer()

    return executeUseCase(c, () =>
      container.useCases.resumeSubscription.execute({
        subscriptionId: Number(subscription_id),
      })
    )
  }
)

// Cancel subscription (mark for cancellation on renewal)
app.post("/cancel/:subscription_id", async (c) => {
  const { subscription_id } = c.req.param()

  if (!subscription_id) {
    return c.json({ success: "error", error: "subscription_id is required" }, 400)
  }

  const container = getContainer()

  // Check authorization
  const subscription = await container.repositories.subscription.findById(Number(subscription_id))
  if (!subscription) {
    return c.json({ success: "error", error: "Subscription not found" }, 404)
  }

  const user = c.get("user")
  const tokenOwner = c.get("token_owner")
  const tokenOwnerCaps = tokenOwner?.capabilities || []

  const isOwner = user?.user_id === subscription.user_id
  const hasPermission = tokenOwnerCaps.includes("payments_create")

  if (!isOwner && !hasPermission) {
    return c.json({ success: "error", error: "Unauthorized" }, 403)
  }

  return executeUseCase(c, () =>
    container.useCases.cancelOnRenewal.execute({
      subscriptionId: Number(subscription_id),
      cancel: true,
    })
  )
})

// Uncancel subscription
app.post("/uncancel/:subscription_id", async (c) => {
  const { subscription_id } = c.req.param()

  if (!subscription_id) {
    return c.json({ success: "error", error: "subscription_id is required" }, 400)
  }

  const container = getContainer()

  // Check authorization
  const subscription = await container.repositories.subscription.findById(Number(subscription_id))
  if (!subscription) {
    return c.json({ success: "error", error: "Subscription not found" }, 404)
  }

  const user = c.get("user")
  const tokenOwner = c.get("token_owner")
  const tokenOwnerCaps = tokenOwner?.capabilities || []

  const isOwner = user?.user_id === subscription.user_id
  const hasPermission = tokenOwnerCaps.includes("payments_create")

  if (!isOwner && !hasPermission) {
    return c.json({ success: "error", error: "Unauthorized" }, 403)
  }

  return executeUseCase(c, () =>
    container.useCases.cancelOnRenewal.execute({
      subscriptionId: Number(subscription_id),
      cancel: false,
    })
  )
})

// Downgrade subscription (mark for downgrade on renewal)
app.post("/downgrade/:subscription_id", async (c) => {
  const { subscription_id } = c.req.param()

  if (!subscription_id) {
    return c.json({ success: "error", error: "subscription_id is required" }, 400)
  }

  const container = getContainer()

  // Check authorization
  const subscription = await container.repositories.subscription.findById(Number(subscription_id))
  if (!subscription) {
    return c.json({ success: "error", error: "Subscription not found" }, 404)
  }

  const user = c.get("user")
  const tokenOwner = c.get("token_owner")
  const tokenOwnerCaps = tokenOwner?.capabilities || []

  const isOwner = user?.user_id === subscription.user_id
  const hasPermission = tokenOwnerCaps.includes("payments_create")

  if (!isOwner && !hasPermission) {
    return c.json({ success: "error", error: "Unauthorized" }, 403)
  }

  return executeUseCase(c, () =>
    container.useCases.markForDowngrade.execute({
      subscriptionId: Number(subscription_id),
      downgrade: true,
    })
  )
})

// Undowngrade subscription
app.post("/undowngrade/:subscription_id", async (c) => {
  const { subscription_id } = c.req.param()

  if (!subscription_id) {
    return c.json({ success: "error", error: "subscription_id is required" }, 400)
  }

  const container = getContainer()

  // Check authorization
  const subscription = await container.repositories.subscription.findById(Number(subscription_id))
  if (!subscription) {
    return c.json({ success: "error", error: "Subscription not found" }, 404)
  }

  const user = c.get("user")
  const tokenOwner = c.get("token_owner")
  const tokenOwnerCaps = tokenOwner?.capabilities || []

  const isOwner = user?.user_id === subscription.user_id
  const hasPermission = tokenOwnerCaps.includes("payments_create")

  if (!isOwner && !hasPermission) {
    return c.json({ success: "error", error: "Unauthorized" }, 403)
  }

  return executeUseCase(c, () =>
    container.useCases.markForDowngrade.execute({
      subscriptionId: Number(subscription_id),
      downgrade: false,
    })
  )
})

export const subscriptionRoutes = app
