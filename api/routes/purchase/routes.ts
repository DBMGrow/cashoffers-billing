import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import { NewUserPurchaseRoute, ExistingUserPurchaseRoute } from "./schemas"
import { setCookie } from "hono/cookie"
import { TestModeDetector } from "@api/infrastructure/payment/test-mode-detector"
import { config } from "@api/config/config.service"
import { authMiddleware } from "@api/lib/middleware/authMiddleware"
import { purchaseNewUserUseCase, purchaseExistingUserUseCase } from "@api/use-cases/subscription"
import { productRepository, userCardRepository } from "@api/lib/repositories"
import { userApiClient } from "@api/lib/services"
import { isUserFacingError } from "@api/use-cases/subscription/purchase-helpers"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

function purchaseErrorStatus(code: string | undefined): 400 | 500 {
  return isUserFacingError(code) ? 400 : 500
}

// POST /purchase/existing — requires session auth (x-api-token header or _api_token cookie)
app.use("/existing", authMiddleware(null))

// POST /purchase/new — create subscription for a new user (no auth)
app.openapi(NewUserPurchaseRoute, async (c) => {
  const body = c.req.valid("json")

  const testModeDetector = new TestModeDetector()
  const paymentContext = testModeDetector.detectTestMode(c, {
    email: body.email,
    user_id: undefined,
    capabilities: [],
  })

  const effectiveContext = body.mock_purchase ? { ...paymentContext, testMode: true } : paymentContext

  try {
    const useCaseResult = await purchaseNewUserUseCase.execute({
      productId: body.product_id,
      email: body.email,
      phone: body.phone,
      cardToken: body.card_token ?? undefined,
      expMonth: body.exp_month ? Number(body.exp_month) : undefined,
      expYear: body.exp_year ? Number(body.exp_year) : undefined,
      cardholderName: body.cardholder_name ?? undefined,
      name: body.name,
      whitelabel: body.whitelabel,
      slug: body.slug,
      url: body.url,
      nameBroker: body.name_broker,
      nameTeam: body.name_team,
      isInvestor: body.isInvestor,
      coupon: body.coupon,
      context: effectiveContext,
    })

    if (!useCaseResult.success) {
      return c.json(
        {
          success: "error" as const,
          error: useCaseResult.error,
          code: useCaseResult.code,
        },
        purchaseErrorStatus(useCaseResult.code)
      )
    }

    const data = useCaseResult.data

    const userId = data.userId  // null when provisioning was deferred

    const [product, user, userCards] = await Promise.all([
      productRepository.findById(typeof body.product_id === "number" ? body.product_id : parseInt(body.product_id, 10)),
      userId != null ? userApiClient.getUser(userId) : Promise.resolve(null),
      userId != null ? userCardRepository.findByUserId(userId) : Promise.resolve([]),
    ])

    // Set session cookie only when we have a real user with an api_token
    const newUserApiToken = (user as any)?._api_token
    if (newUserApiToken) {
      setCookie(c, "_api_token", newUserApiToken, {
        httpOnly: true,
        secure: config.nodeEnv === "production",
        sameSite: "Lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    return c.json(
      {
        success: "success" as const,
        data: {
          subscription: {
            subscriptionId: data.subscriptionId,
            userId: data.userId ?? 0,
            productId: data.productId,
            amount: data.amount,
          },
          product: product as any,
          user: user as any,
          userCard: (userCards as any[]).length > 0 ? (userCards as any[])[0] : null,
          userCreated: data.userCreated,
          userProvisioned: data.userProvisioned,
          proratedCharge: data.proratedCharge,
        },
        environment: (paymentContext?.testMode ? "sandbox" : "production") as "sandbox" | "production",
      },
      200
    )
  } catch (error: any) {
    return c.json(
      {
        success: "error" as const,
        error: error.message || "An unexpected error occurred",
        code: error.code,
      },
      500
    )
  }
})

// POST /purchase/existing — create subscription for an authenticated existing user
app.openapi(ExistingUserPurchaseRoute, async (c) => {
  const body = c.req.valid("json")

  // User identity comes from the session token resolved by authMiddleware
  const sessionUser = c.get("user")
  const paymentContext = c.get("paymentContext")
  const effectiveContext = body.mock_purchase ? { ...paymentContext, testMode: true } : paymentContext

  try {
    const useCaseResult = await purchaseExistingUserUseCase.execute({
      userId: sessionUser.user_id,
      productId: body.product_id,
      email: sessionUser.email,
      cardToken: body.card_token ?? undefined,
      expMonth: body.exp_month ? Number(body.exp_month) : undefined,
      expYear: body.exp_year ? Number(body.exp_year) : undefined,
      cardholderName: body.cardholder_name ?? undefined,
      coupon: body.coupon ?? undefined,
      context: effectiveContext,
    })

    if (!useCaseResult.success) {
      return c.json(
        {
          success: "error" as const,
          error: useCaseResult.error,
          code: useCaseResult.code,
        },
        purchaseErrorStatus(useCaseResult.code)
      )
    }

    const data = useCaseResult.data

    const existingUserId = data.userId ?? sessionUser.user_id
    const [product, user, userCards] = await Promise.all([
      productRepository.findById(typeof body.product_id === "number" ? body.product_id : parseInt(body.product_id, 10)),
      userApiClient.getUser(existingUserId),
      userCardRepository.findByUserId(existingUserId),
    ])

    return c.json(
      {
        success: "success" as const,
        data: {
          subscription: {
            subscriptionId: data.subscriptionId,
            userId: data.userId ?? 0,
            productId: data.productId,
            amount: data.amount,
          },
          product: product as any,
          user: user as any,
          userCard: userCards.length > 0 ? (userCards[0] as any) : null,
          userCreated: data.userCreated,
          proratedCharge: data.proratedCharge,
        },
        environment: (paymentContext?.testMode ? "sandbox" : "production") as "sandbox" | "production",
      },
      200
    )
  } catch (error: any) {
    return c.json(
      {
        success: "error" as const,
        error: error.message || "An unexpected error occurred",
        code: error.code,
      },
      500
    )
  }
})

export const purchaseRoutes = app
