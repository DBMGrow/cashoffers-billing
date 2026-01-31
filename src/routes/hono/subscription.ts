import { Hono } from "hono"
import type { HonoVariables } from "../../types/hono"
import { authMiddleware } from "../../middleware/hono/authMiddleware"
import { getContainer } from "@/container"

const app = new Hono<{ Variables: HonoVariables }>()

// Get all subscriptions with pagination
app.get("/", authMiddleware("payments_read_all", { allowSelf: true }), async (c) => {
  const query = c.req.query()
  const { page = "1", limit = "20" } = query

  try {
    const container = getContainer()
    const getSubscriptionsUseCase = container.useCases.getSubscriptions

    const result = await getSubscriptionsUseCase.execute({
      page: Number(page),
      limit: Number(limit),
    })

    if (!result.success) {
      return c.json({ success: "error", error: result.error }, 400)
    }

    return c.json({
      success: "success",
      data: result.data.subscriptions,
      page: result.data.page,
      limit: result.data.limit,
      total: result.data.total,
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
    const container = getContainer()
    const getSubscriptionsUseCase = container.useCases.getSubscriptions

    const result = await getSubscriptionsUseCase.execute({
      userId: user_id,
      page: 1,
      limit: 1,
    })

    if (!result.success) {
      return c.json({ success: "error", error: result.error }, 400)
    }

    return c.json({ success: "success", data: result.data.subscriptions })
  } catch (error: any) {
    return c.json({ success: "error", error: error.message })
  }
})

// Create or update subscription
app.post("/", authMiddleware("payments_create"), async (c) => {
  const body = await c.req.json()
  const { user_id, subscription_name, amount, duration, product_id, signup_fee } = body

  try {
    if (!user_id) throw new Error("user_id is required")

    const container = getContainer()
    const getSubscriptionsUseCase = container.useCases.getSubscriptions
    const createSubscriptionUseCase = container.useCases.createSubscription

    // Check if subscription exists
    const existingResult = await getSubscriptionsUseCase.execute({
      userId: user_id,
    })

    const existingSubscription =
      existingResult.success && existingResult.data.subscriptions.length > 0
        ? existingResult.data.subscriptions[0]
        : null

    if (existingSubscription) {
      // Update existing subscription (keep direct update for now as UpdateSubscriptionUseCase is not fully implemented)
      const subscriptionRepository = container.repositories.subscription
      const transactionRepository = container.repositories.transaction

      const updates: any = {}
      if (subscription_name) updates.subscription_name = subscription_name
      if (amount) updates.amount = amount
      if (duration) updates.duration = duration

      await subscriptionRepository.update(existingSubscription.subscriptionId, {
        ...updates,
        updatedAt: new Date(),
      })

      const now = new Date()
      await transactionRepository.create({
        user_id,
        amount: 0,
        type: "subscription",
        memo: subscription_name + " updated",
        data: JSON.stringify(updates),
        createdAt: now,
        updatedAt: now,
      })

      return c.json({ success: "success", data: existingSubscription })
    } else {
      // Create new subscription using use case
      const user = c.get("user")
      const email = user?.email || body.email || ""

      const result = await createSubscriptionUseCase.execute({
        userId: user_id,
        productId: product_id || subscription_name,
        email,
        userAlreadyExists: true,
        waiveSignupFee: signup_fee === 0,
      })

      if (!result.success) {
        return c.json({
          success: "error",
          error: result.error,
          code: result.code,
        }, 400)
      }

      return c.json({ success: "success", data: result.data })
    }
  } catch (error: any) {
    const container = getContainer()
    const transactionRepository = container.repositories.transaction

    const now = new Date()
    await transactionRepository.create({
      user_id: body.user_id || 0,
      amount: 0,
      type: "subscription",
      memo: "subscription operation failed",
      data: error.message,
      createdAt: now,
      updatedAt: now,
    })
    return c.json({ success: "error", error: error.message, body })
  }
})

// Update subscription
app.put("/", authMiddleware("payments_create"), async (c) => {
  const body = await c.req.json()
  const { user_id, subscription_name, amount, duration, status } = body

  try {
    const container = getContainer()
    const subscriptionRepository = container.repositories.subscription
    const transactionRepository = container.repositories.transaction

    // Find user's subscription
    const subscriptions = await subscriptionRepository.findByUserId(user_id)
    if (subscriptions.length === 0) {
      throw new Error("No subscription found for user")
    }

    const subscription = subscriptions[0]

    const updateBody: any = {}
    if (subscription_name) updateBody.subscription_name = subscription_name
    if (amount) updateBody.amount = amount
    if (duration) updateBody.duration = duration
    if (status) updateBody.status = status

    await subscriptionRepository.update(subscription.subscription_id, {
      ...updateBody,
      updatedAt: new Date(),
    })

    const now = new Date()
    await transactionRepository.create({
      user_id,
      amount: 0,
      type: "subscription",
      memo: subscription_name + " updated",
      data: JSON.stringify(updateBody),
      createdAt: now,
      updatedAt: now,
    })

    return c.json({ success: "success", data: updateBody })
  } catch (error: any) {
    const container = getContainer()
    const transactionRepository = container.repositories.transaction

    const now = new Date()
    await transactionRepository.create({
      user_id,
      amount: 0,
      type: "subscription",
      memo: body.subscription_name + " failed to update",
      data: error.message,
      createdAt: now,
      updatedAt: now,
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

    const container = getContainer()
    const subscriptionRepository = container.repositories.subscription

    // Find user's subscription
    const subscriptions = await subscriptionRepository.findByUserId(user_id)
    if (subscriptions.length === 0) {
      throw new Error("No subscription found for user")
    }

    const subscription = subscriptions[0]

    await subscriptionRepository.update(subscription.subscription_id, {
      status: "inactive",
      updatedAt: new Date(),
    })

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

      const container = getContainer()
      const pauseSubscriptionUseCase = container.useCases.pauseSubscription

      const result = await pauseSubscriptionUseCase.execute({
        subscriptionId: Number(subscription_id),
      })

      if (!result.success) {
        return c.json({ success: "error", error: result.error }, 400)
      }

      return c.json({ success: "success", data: result.data })
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

      const container = getContainer()
      const resumeSubscriptionUseCase = container.useCases.resumeSubscription

      const result = await resumeSubscriptionUseCase.execute({
        subscriptionId: Number(subscription_id),
      })

      if (!result.success) {
        return c.json({ success: "error", error: result.error }, 400)
      }

      return c.json({ success: "success", data: result.data })
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

    const container = getContainer()
    const subscriptionRepository = container.repositories.subscription
    const subscription = await subscriptionRepository.findById(Number(subscription_id))

    if (!subscription) throw new Error("Subscription not found")

    // Custom auth: check if user owns subscription or has payments_create permission
    const user = c.get("user")
    const tokenOwner = c.get("token_owner")
    const tokenOwnerCaps = tokenOwner?.capabilities || []

    const isOwner = user?.user_id === subscription.user_id
    const hasPermission = tokenOwnerCaps.includes("payments_create")

    if (!isOwner && !hasPermission) {
      return c.json({ success: "error", error: "Unauthorized" })
    }

    const cancelOnRenewalUseCase = container.useCases.cancelOnRenewal

    const result = await cancelOnRenewalUseCase.execute({
      subscriptionId: Number(subscription_id),
      cancel: true,
    })

    if (!result.success) {
      return c.json({ success: "error", error: result.error }, 400)
    }

    return c.json({ success: "success", data: result.data })
  } catch (error: any) {
    return c.json({ success: "error", error: error.message })
  }
})

// Uncancel subscription
app.post("/uncancel/:subscription_id", async (c) => {
  const { subscription_id } = c.req.param()

  try {
    if (!subscription_id) throw new Error("subscription_id is required")

    const container = getContainer()
    const subscriptionRepository = container.repositories.subscription
    const subscription = await subscriptionRepository.findById(Number(subscription_id))

    if (!subscription) throw new Error("Subscription not found")

    // Custom auth: check if user owns subscription or has payments_create permission
    const user = c.get("user")
    const tokenOwner = c.get("token_owner")
    const tokenOwnerCaps = tokenOwner?.capabilities || []

    const isOwner = user?.user_id === subscription.user_id
    const hasPermission = tokenOwnerCaps.includes("payments_create")

    if (!isOwner && !hasPermission) {
      return c.json({ success: "error", error: "Unauthorized" })
    }

    const cancelOnRenewalUseCase = container.useCases.cancelOnRenewal

    const result = await cancelOnRenewalUseCase.execute({
      subscriptionId: Number(subscription_id),
      cancel: false,
    })

    if (!result.success) {
      return c.json({ success: "error", error: result.error }, 400)
    }

    return c.json({ success: "success", data: result.data })
  } catch (error: any) {
    return c.json({ success: "error", error: error.message })
  }
})

// Downgrade subscription (mark for downgrade on renewal)
app.post("/downgrade/:subscription_id", async (c) => {
  const { subscription_id } = c.req.param()

  try {
    if (!subscription_id) throw new Error("subscription_id is required")

    const container = getContainer()
    const subscriptionRepository = container.repositories.subscription
    const subscription = await subscriptionRepository.findById(Number(subscription_id))

    if (!subscription) throw new Error("Subscription not found")

    // Custom auth: check if user owns subscription or has payments_create permission
    const user = c.get("user")
    const tokenOwner = c.get("token_owner")
    const tokenOwnerCaps = tokenOwner?.capabilities || []

    const isOwner = user?.user_id === subscription.user_id
    const hasPermission = tokenOwnerCaps.includes("payments_create")

    if (!isOwner && !hasPermission) {
      return c.json({ success: "error", error: "Unauthorized" })
    }

    const markForDowngradeUseCase = container.useCases.markForDowngrade

    const result = await markForDowngradeUseCase.execute({
      subscriptionId: Number(subscription_id),
      downgrade: true,
    })

    if (!result.success) {
      return c.json({ success: "error", error: result.error }, 400)
    }

    return c.json({ success: "success", data: result.data })
  } catch (error: any) {
    return c.json({ success: "error", error: error.message })
  }
})

// Undowngrade subscription
app.post("/undowngrade/:subscription_id", async (c) => {
  const { subscription_id } = c.req.param()

  try {
    if (!subscription_id) throw new Error("subscription_id is required")

    const container = getContainer()
    const subscriptionRepository = container.repositories.subscription
    const subscription = await subscriptionRepository.findById(Number(subscription_id))

    if (!subscription) throw new Error("Subscription not found")

    // Custom auth: check if user owns subscription or has payments_create permission
    const user = c.get("user")
    const tokenOwner = c.get("token_owner")
    const tokenOwnerCaps = tokenOwner?.capabilities || []

    const isOwner = user?.user_id === subscription.user_id
    const hasPermission = tokenOwnerCaps.includes("payments_create")

    if (!isOwner && !hasPermission) {
      return c.json({ success: "error", error: "Unauthorized" })
    }

    const markForDowngradeUseCase = container.useCases.markForDowngrade

    const result = await markForDowngradeUseCase.execute({
      subscriptionId: Number(subscription_id),
      downgrade: false,
    })

    if (!result.success) {
      return c.json({ success: "error", error: result.error }, 400)
    }

    return c.json({ success: "success", data: result.data })
  } catch (error: any) {
    return c.json({ success: "error", error: error.message })
  }
})

export const subscriptionRoutes = app
