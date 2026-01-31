import { Hono } from "hono"
import type { HonoVariables } from "../../types/hono"
import { authMiddleware } from "../../middleware/hono/authMiddleware"
import { getContainer } from "@/container"

const app = new Hono<{ Variables: HonoVariables }>()

// Main purchase endpoint
app.post("/", authMiddleware("payments_create", { allowSelf: true }), async (c) => {
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

  try {
    // Get use case from container
    const container = getContainer()
    const purchaseSubscriptionUseCase = container.useCases.purchaseSubscription

    // Execute use case
    const result = await purchaseSubscriptionUseCase.execute({
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
    })

    if (!result.success) {
      return c.json({
        success: "error",
        error: result.error,
        code: result.code,
      }, 400)
    }

    // Get product details for response
    const productRepository = container.repositories.product
    const product = await productRepository.findById(
      typeof product_id === "number" ? product_id : parseInt(product_id, 10)
    )

    // Get user and card for response
    const userApiClient = container.services.userApi
    const user = await userApiClient.getUser(result.data.userId)

    const userCardRepository = container.repositories.userCard
    const userCards = await userCardRepository.findByUserId(result.data.userId)
    const userCard = userCards.length > 0 ? userCards[0] : null

    return c.json({
      success: "success",
      data: {
        subscription: {
          subscriptionId: result.data.subscriptionId,
          userId: result.data.userId,
          productId: result.data.productId,
          amount: result.data.amount,
        },
        product,
        user,
        userCard,
        userCreated: result.data.userCreated,
        proratedCharge: result.data.proratedCharge,
      },
    })
  } catch (error: any) {
    return c.json({
      success: "error",
      error: error.message || "Purchase failed",
    }, 500)
  }
})

export const purchaseRoutes = app
