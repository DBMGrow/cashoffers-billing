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

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

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

  const effectiveContext = body.mock_purchase ? { ...paymentContext, mockPurchase: true } : paymentContext

  try {
    const useCaseResult = await purchaseNewUserUseCase.execute({
      productId: body.product_id,
      email: body.email,
      phone: body.phone,
      cardToken: body.card_token,
      expMonth: Number(body.exp_month),
      expYear: Number(body.exp_year),
      cardholderName: body.cardholder_name,
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
        400
      )
    }

    const data = useCaseResult.data

    const [product, user, userCards] = await Promise.all([
      productRepository.findById(typeof body.product_id === "number" ? body.product_id : parseInt(body.product_id, 10)),
      userApiClient.getUser(data.userId),
      userCardRepository.findByUserId(data.userId),
    ])

    // Set session cookie for the newly created user if their api_token is available
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
            userId: data.userId,
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

// POST /purchase/existing — create subscription for an authenticated existing user
app.openapi(ExistingUserPurchaseRoute, async (c) => {
  const body = c.req.valid("json")

  // User identity comes from the session token resolved by authMiddleware
  const sessionUser = c.get("user")
  const paymentContext = c.get("paymentContext")
  const effectiveContext = body.mock_purchase ? { ...paymentContext, mockPurchase: true } : paymentContext

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
        400
      )
    }

    const data = useCaseResult.data

    const [product, user, userCards] = await Promise.all([
      productRepository.findById(typeof body.product_id === "number" ? body.product_id : parseInt(body.product_id, 10)),
      userApiClient.getUser(data.userId),
      userCardRepository.findByUserId(data.userId),
    ])

    return c.json(
      {
        success: "success" as const,
        data: {
          subscription: {
            subscriptionId: data.subscriptionId,
            userId: data.userId,
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
