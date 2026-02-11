import { Hono } from "hono"
import type { HonoVariables } from "@/types/hono"
import { authMiddleware } from "@/middleware/authMiddleware"
import { getContainer } from "@/container"
import { executeUseCase } from "./helpers/use-case-handler"
import { checkSubscriptionAuthorization } from "./helpers/subscription-auth"

const app = new Hono<{ Variables: HonoVariables }>()

// Get all subscriptions with pagination
app.get("/", authMiddleware("payments_read_all"), async (c) => {
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
app.get("/single", authMiddleware(null), async (c) => {
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
    // Update existing subscription using use case
    return executeUseCase(c, () =>
      container.useCases.updateSubscriptionFields.execute({
        subscriptionId: existingSubscription.subscriptionId,
        subscriptionName: subscription_name,
        amount: amount ? Number(amount) : undefined,
        duration,
      })
    )
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
  const { subscription_id, subscription_name, amount, duration, status } = body

  if (!subscription_id) {
    return c.json({ success: "error", error: "subscription_id is required" }, 400)
  }

  const container = getContainer()

  return executeUseCase(c, () =>
    container.useCases.updateSubscriptionFields.execute({
      subscriptionId: Number(subscription_id),
      subscriptionName: subscription_name,
      amount: amount ? Number(amount) : undefined,
      duration,
      status,
    })
  )
})

// Delete (deactivate) subscription
app.delete("/", authMiddleware("payments_delete"), async (c) => {
  const body = await c.req.json()
  const { user_id } = body

  if (!user_id) {
    return c.json({ success: "error", error: "user_id is required" }, 400)
  }

  const container = getContainer()

  return executeUseCase(c, () =>
    container.useCases.deactivateSubscription.execute({
      userId: user_id,
    })
  )
})

// Pause subscription
app.post(
  "/pause/:subscription_id",
  authMiddleware("payments_create"),
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
  authMiddleware("payments_create"),
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
  const authResult = await checkSubscriptionAuthorization(c, Number(subscription_id))

  if (!authResult.authorized) {
    return authResult.errorResponse
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
  const authResult = await checkSubscriptionAuthorization(c, Number(subscription_id))

  if (!authResult.authorized) {
    return authResult.errorResponse
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
  const authResult = await checkSubscriptionAuthorization(c, Number(subscription_id))

  if (!authResult.authorized) {
    return authResult.errorResponse
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
  const authResult = await checkSubscriptionAuthorization(c, Number(subscription_id))

  if (!authResult.authorized) {
    return authResult.errorResponse
  }

  return executeUseCase(c, () =>
    container.useCases.markForDowngrade.execute({
      subscriptionId: Number(subscription_id),
      downgrade: false,
    })
  )
})

export const subscriptionRoutes = app
