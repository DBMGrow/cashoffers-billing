import { Hono } from "hono"
import type { HonoVariables } from "../../types/hono"
import { authMiddleware } from "../../middleware/authMiddleware"
import { getContainer } from "@/container"
import { executeUseCase } from "./helpers/use-case-handler"

const app = new Hono<{ Variables: HonoVariables }>()

// Main purchase endpoint
app.post("/", authMiddleware("payments_create"), async (c) => {
  const body = await c.req.json()
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

  // Execute use case with clean error handling
  const result = await executeUseCase(c, async () => {
    return container.useCases.purchaseSubscription.execute({
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
  })

  // If the use case succeeded, enhance the response with additional data
  if (result && typeof result === "object" && "success" in result && result.success === "success") {
    const data = (result as any).data

    // Fetch additional data for response
    const [product, user, userCards] = await Promise.all([
      container.repositories.product.findById(
        typeof product_id === "number" ? product_id : parseInt(product_id, 10)
      ),
      container.services.userApi.getUser(data.userId),
      container.repositories.userCard.findByUserId(data.userId),
    ])

    return c.json({
      success: "success",
      data: {
        subscription: {
          subscriptionId: data.subscriptionId,
          userId: data.userId,
          productId: data.productId,
          amount: data.amount,
        },
        product,
        user,
        userCard: userCards.length > 0 ? userCards[0] : null,
        userCreated: data.userCreated,
        proratedCharge: data.proratedCharge,
      },
      environment: paymentContext?.testMode ? 'sandbox' : 'production', // Show which environment was used
    })
  }

  return result
})

export const purchaseRoutes = app
