import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import { getContainer } from "@api/container"
import { PurchaseRoute } from "./schemas/purchase.schemas"
import { setCookie } from "hono/cookie"
import { TestModeDetector } from "@api/infrastructure/payment/test-mode-detector"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

// Note: No auth middleware - this endpoint is used for new user signups
// who don't have API tokens yet. The use case handles creating new users.

// Main purchase endpoint
app.openapi(PurchaseRoute, async (c) => {
  const body = c.req.valid("json")
  const {
    product_id,
    email,
    name,
    coupon,
    phone,
    card_token,
    exp_month,
    exp_year,
    cardholder_name,
    api_token,
    whitelabel,
    slug,
    url,
    mock_purchase,
    name_broker,
    name_team,
    isInvestor,
  } = body

  const container = getContainer()

  // Detect test mode based on email (since we don't have auth for new users)
  const testModeDetector = new TestModeDetector()
  const paymentContext = testModeDetector.detectTestMode(c, {
    email,
    user_id: undefined,
    capabilities: [],
  })

  // Override context for mock purchases
  const effectiveContext = mock_purchase
    ? { ...paymentContext, mockPurchase: true }
    : paymentContext

  try {
    // Execute use case
    const useCaseResult = await container.useCases.purchaseSubscription.execute({
      productId: product_id,
      email,
      name,
      cardToken: card_token,
      expMonth: exp_month ? Number(exp_month) : undefined,
      expYear: exp_year ? Number(exp_year) : undefined,
      cardholderName: cardholder_name,
      apiToken: api_token,
      phone,
      whitelabel,
      slug,
      url,
      nameBroker: name_broker,
      nameTeam: name_team,
      isInvestor,
      coupon,
      context: effectiveContext, // Pass context with mock flag
    })

    // Handle error response
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

    // If successful, enhance response with additional data
    const data = useCaseResult.data

    // Fetch additional data for response
    const [product, user, userCards] = await Promise.all([
      container.repositories.product.findById(typeof product_id === "number" ? product_id : parseInt(product_id, 10)),
      container.services.userApi.getUser(data.userId),
      container.repositories.userCard.findByUserId(data.userId),
    ])

    // Set authentication cookie if api_token was provided
    if (api_token) {
      setCookie(c, "_api_token", api_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    // Return custom enhanced response
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
