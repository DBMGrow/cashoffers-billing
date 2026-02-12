import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import { authMiddleware } from "@api/middleware/authMiddleware"
import { getContainer } from "@api/container"
import { executeUseCase } from "./helpers/use-case-handler"
import { checkSubscriptionAuthorization } from "./helpers/subscription-auth"
import {
  GetAllSubscriptionsRoute,
  GetOwnSubscriptionRoute,
  CreateOrUpdateSubscriptionRoute,
  UpdateSubscriptionRoute,
  DeleteSubscriptionRoute,
  PauseSubscriptionRoute,
  ResumeSubscriptionRoute,
  CancelSubscriptionRoute,
  UncancelSubscriptionRoute,
  DowngradeSubscriptionRoute,
  UndowngradeSubscriptionRoute,
} from "./schemas/subscription.schemas"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

// Apply auth middleware
app.use("/", authMiddleware("payments_read_all")) // For GET /
app.use("/single", authMiddleware(null)) // For GET /single
app.use("/pause/:subscription_id", authMiddleware("payments_create"))
app.use("/resume/:subscription_id", authMiddleware("payments_create"))

// POST / and PUT / use payments_create
app.use("/", authMiddleware("payments_create"))

// DELETE uses payments_delete (applied after GET to avoid conflicts)

// Get all subscriptions with pagination (admin only)
app.openapi(GetAllSubscriptionsRoute, async (c) => {
  const query = c.req.valid("query")
  const { page = 1, limit = 20 } = query

  const container = getContainer()

  return executeUseCase(c, () =>
    container.useCases.getSubscriptions.execute({
      page: Number(page),
      limit: Number(limit),
    })
  )
})

// Get your own subscription
app.openapi(GetOwnSubscriptionRoute, async (c) => {
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
app.openapi(CreateOrUpdateSubscriptionRoute, async (c) => {
  const body = c.req.valid("json")
  const { user_id, subscription_name, amount, duration, product_id, signup_fee } = body

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
      productId: product_id || subscription_name || "default",
      email,
      userAlreadyExists: true,
      waiveSignupFee: signup_fee === 0,
    })
  )
})

// Update subscription
app.openapi(UpdateSubscriptionRoute, async (c) => {
  const body = c.req.valid("json")
  const { subscription_id, subscription_name, amount, duration, status } = body

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
app.use("/", authMiddleware("payments_delete")) // Apply for DELETE method specifically
app.openapi(DeleteSubscriptionRoute, async (c) => {
  const body = c.req.valid("json")
  const { user_id } = body

  const container = getContainer()

  return executeUseCase(c, () =>
    container.useCases.deactivateSubscription.execute({
      userId: user_id,
    })
  )
})

// Pause subscription
app.openapi(PauseSubscriptionRoute, async (c) => {
  const { subscription_id } = c.req.valid("param")

  const container = getContainer()

  return executeUseCase(c, () =>
    container.useCases.pauseSubscription.execute({
      subscriptionId: Number(subscription_id),
    })
  )
})

// Resume subscription
app.openapi(ResumeSubscriptionRoute, async (c) => {
  const { subscription_id } = c.req.valid("param")

  const container = getContainer()

  return executeUseCase(c, () =>
    container.useCases.resumeSubscription.execute({
      subscriptionId: Number(subscription_id),
    })
  )
})

// Cancel subscription (mark for cancellation on renewal)
app.openapi(CancelSubscriptionRoute, async (c) => {
  const { subscription_id } = c.req.valid("param")

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
app.openapi(UncancelSubscriptionRoute, async (c) => {
  const { subscription_id } = c.req.valid("param")

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
app.openapi(DowngradeSubscriptionRoute, async (c) => {
  const { subscription_id } = c.req.valid("param")

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
app.openapi(UndowngradeSubscriptionRoute, async (c) => {
  const { subscription_id } = c.req.valid("param")

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
