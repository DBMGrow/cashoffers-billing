import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import { authMiddleware } from "@api/lib/middleware/authMiddleware"
import {
  getSubscriptionsUseCase,
  updateSubscriptionFieldsUseCase,
  createSubscriptionUseCase,
  pauseSubscriptionUseCase,
  resumeSubscriptionUseCase,
  cancelOnRenewalUseCase,
  markForDowngradeUseCase,
  deactivateSubscriptionUseCase,
  renewSubscriptionUseCase,
} from "@api/use-cases/subscription"
import { subscriptionRepository } from "@api/lib/repositories"
import { db } from "@api/lib/database"
import { executeUseCase } from "../helpers/use-case-handler"
import { checkSubscriptionAuthorization } from "../helpers/subscription-auth"
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
  RetryRenewalRoute,
  RunRenewalForUserRoute,
} from "./schemas"

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

  return executeUseCase(c, () =>
    getSubscriptionsUseCase.execute({
      page: Number(page),
      limit: Number(limit),
    })
  )
})

// Get your own subscription
app.openapi(GetOwnSubscriptionRoute, async (c) => {
  const user = c.get("user")
  const { user_id } = user

  return executeUseCase(c, () =>
    getSubscriptionsUseCase.execute({
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

  // Check if subscription exists
  const existingResult = await getSubscriptionsUseCase.execute({ userId: user_id })

  const existingSubscription =
    existingResult.success && existingResult.data.subscriptions.length > 0 ? existingResult.data.subscriptions[0] : null

  if (existingSubscription) {
    // Update existing subscription using use case
    return executeUseCase(c, () =>
      updateSubscriptionFieldsUseCase.execute({
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
    createSubscriptionUseCase.execute({
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

  return executeUseCase(c, () =>
    updateSubscriptionFieldsUseCase.execute({
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

  return executeUseCase(c, () =>
    deactivateSubscriptionUseCase.execute({
      userId: user_id,
    })
  )
})

// Pause subscription
app.openapi(PauseSubscriptionRoute, async (c) => {
  const { subscription_id } = c.req.valid("param")

  return executeUseCase(c, () =>
    pauseSubscriptionUseCase.execute({
      subscriptionId: Number(subscription_id),
    })
  )
})

// Resume subscription
app.openapi(ResumeSubscriptionRoute, async (c) => {
  const { subscription_id } = c.req.valid("param")

  return executeUseCase(c, () =>
    resumeSubscriptionUseCase.execute({
      subscriptionId: Number(subscription_id),
    })
  )
})

// Cancel subscription (mark for cancellation on renewal)
app.openapi(CancelSubscriptionRoute, async (c) => {
  const { subscription_id } = c.req.valid("param")

  const authResult = await checkSubscriptionAuthorization(c, Number(subscription_id))

  if (!authResult.authorized) {
    return authResult.errorResponse
  }

  return executeUseCase(c, () =>
    cancelOnRenewalUseCase.execute({
      subscriptionId: Number(subscription_id),
      cancel: true,
    })
  )
})

// Uncancel subscription
app.openapi(UncancelSubscriptionRoute, async (c) => {
  const { subscription_id } = c.req.valid("param")

  const authResult = await checkSubscriptionAuthorization(c, Number(subscription_id))

  if (!authResult.authorized) {
    return authResult.errorResponse
  }

  return executeUseCase(c, () =>
    cancelOnRenewalUseCase.execute({
      subscriptionId: Number(subscription_id),
      cancel: false,
    })
  )
})

// Downgrade subscription (mark for downgrade on renewal)
app.openapi(DowngradeSubscriptionRoute, async (c) => {
  const { subscription_id } = c.req.valid("param")

  const authResult = await checkSubscriptionAuthorization(c, Number(subscription_id))

  if (!authResult.authorized) {
    return authResult.errorResponse
  }

  return executeUseCase(c, () =>
    markForDowngradeUseCase.execute({
      subscriptionId: Number(subscription_id),
      downgrade: true,
    })
  )
})

// Undowngrade subscription
app.openapi(UndowngradeSubscriptionRoute, async (c) => {
  const { subscription_id } = c.req.valid("param")

  const authResult = await checkSubscriptionAuthorization(c, Number(subscription_id))

  if (!authResult.authorized) {
    return authResult.errorResponse
  }

  return executeUseCase(c, () =>
    markForDowngradeUseCase.execute({
      subscriptionId: Number(subscription_id),
      downgrade: false,
    })
  )
})

// Retry renewal (admin)
app.use("/retry-renewal/:subscription_id", authMiddleware("payments_create"))
app.openapi(RetryRenewalRoute, async (c) => {
  const { subscription_id } = c.req.valid("param")
  const subscriptionId = Number(subscription_id)

  const sub = await subscriptionRepository.findById(subscriptionId)
  if (!sub) {
    return c.json({ success: "error" as const, error: "Subscription not found", code: "NOT_FOUND" }, 400 as const)
  }

  const user = c.get("user")
  const email = user?.email || ""

  const result = await renewSubscriptionUseCase.execute({ subscriptionId, email })
  return c.json({
    success: "success" as const,
    data: { subscriptionId, success: result.success },
  }, 200 as const)
})

// Run renewal for a specific user (admin) — production-safe equivalent of the cron for a single user
app.use("/run-renewal/:user_id", authMiddleware("payments_create"))
app.openapi(RunRenewalForUserRoute, async (c) => {
  const userId = Number(c.req.valid("param").user_id)

  // Find the user's active subscription
  const activeSubs = await subscriptionRepository.findActiveByUserId(userId)
  if (activeSubs.length === 0) {
    return c.json({ success: "error" as const, error: `No active subscription found for user ${userId}`, code: "NOT_FOUND" }, 404 as const)
  }

  const sub = activeSubs.find((s) => s.status === "active") ?? activeSubs[0]

  // Resolve the user's email
  const dbUser = await db
    .selectFrom("Users")
    .where("user_id", "=", userId)
    .select("email")
    .executeTakeFirst()
  if (!dbUser) {
    return c.json({ success: "error" as const, error: `User ${userId} not found`, code: "NOT_FOUND" }, 404 as const)
  }

  const result = await renewSubscriptionUseCase.execute({
    subscriptionId: sub.subscription_id,
    email: dbUser.email,
  })

  if (!result.success) {
    return c.json({
      success: "error" as const,
      error: result.error ?? "Renewal failed",
      code: "RENEWAL_FAILED",
    }, 400 as const)
  }

  return c.json({
    success: "success" as const,
    data: {
      subscriptionId: sub.subscription_id,
      userId,
      email: dbUser.email,
      result: result.data,
    },
  }, 200 as const)
})

export const subscriptionRoutes = app
