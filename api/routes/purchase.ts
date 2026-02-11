import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@/types/hono"
import { authMiddleware } from "@/middleware/authMiddleware"
import { getContainer } from "@/container"
import { PurchaseRoute } from "./schemas/purchase.schemas"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

// Apply auth middleware
app.use("/", authMiddleware("payments_create"))

// Main purchase endpoint
app.openapi(PurchaseRoute, async (c) => {
  const body = c.req.valid("json")
  const {
    product_id,
    email,
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
    isInvestor,
  } = body

  const container = getContainer()

  // Get payment context from middleware (includes test mode detection)
  const paymentContext = c.get('paymentContext')

  try {
    // Execute use case
    const useCaseResult = await container.useCases.purchaseSubscription.execute({
      productId: product_id,
      email,
      cardToken: card_token,
      expMonth: exp_month ? Number(exp_month) : undefined,
      expYear: exp_year ? Number(exp_year) : undefined,
      cardholderName: cardholder_name,
      apiToken: api_token,
      phone,
      whitelabel,
      slug,
      url,
      isInvestor,
      coupon,
      context: paymentContext, // Pass context for environment selection
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
      container.repositories.product.findById(
        typeof product_id === "number" ? product_id : parseInt(product_id, 10)
      ),
      container.services.userApi.getUser(data.userId),
      container.repositories.userCard.findByUserId(data.userId),
    ])

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
