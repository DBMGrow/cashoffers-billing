import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import jwt from "jsonwebtoken"
import { setCookie } from "hono/cookie"
import { authMiddleware } from "@api/lib/middleware/authMiddleware"
import { db } from "@api/lib/database"
import { calculateProratedUseCase } from "@api/use-cases/subscription"
import { createPaymentUseCase } from "@api/use-cases/payment"
import { executeUseCase } from "../helpers/use-case-handler"
import type { ProductData } from "@api/domain/types/product-data.types"
import { config } from "@api/config/config.service"
import {
  CheckPlanRoute,
  CheckTokenRoute,
  GetProductsRoute,
  GetWhitelabelsRoute,
  GetSubscriptionRoute,
  UpdateCardRoute,
  ManagePurchaseRoute
} from "./schemas"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

/**
 * POST /manage/checkplan
 * Validates whether a user can switch to a different subscription plan
 */
app.openapi(CheckPlanRoute, async (c) => {
  try {
    const body = c.req.valid("json")
    const { subscription, productID } = body
    const apiToken = c.req.header("x-api-token")

    const responseBody: any = {}

    // Fetch user details to check role
    const userResponse = await fetch(`${config.api.routeAuth}/users/${subscription.user_id}`, {
      headers: { "x-api-token": apiToken! },
    })
    const userData: any = await userResponse.json()

    if (userData.success !== "success") {
      throw new Error("Error fetching user")
    }
    const user = userData.data

    // If team subscription, fetch team details
    if (subscription?.data?.team) {
      const headers = { "x-api-token": apiToken! }

      const teamResponse = await fetch(`${config.api.routeAuth}/teams/${subscription.data.team_id}`, { headers })
      const team: any = await teamResponse.json()

      if (team.success !== "success") {
        throw new Error("Error fetching team")
      }
      responseBody.team = team.data

      const url = `${config.api.routeAuth}/users?team_id=${subscription.data.team_id}&active=1`
      const teamUsersResponse = await fetch(url, { headers })
      const teamUsers: any = await teamUsersResponse.json()

      if (teamUsers.success !== "success") {
        throw new Error("Error fetching team users")
      }

      responseBody.teamUsers = teamUsers.data?.map((user: any) => ({
        id: user.user_id,
        email: user.email,
        name: user.name,
      }))
      responseBody.numberOfUsers = responseBody.teamUsers?.length || 0
    }

    // Fetch product details
    const productResponse = await fetch(`${config.api.route}/product/${productID}`, {
      headers: { "x-api-token": config.api.key },
    })
    const product: any = await productResponse.json()

    if (product.success !== "success") {
      throw new Error("Error fetching product")
    }
    responseBody.product = product.data

    // Role validation: check if user can switch to this product
    const userIsAgentType = ["AGENT", "TEAMOWNER"].includes(user.role)
    const productRole = product.data?.data?.user_config?.role
    const productIsAgentType = ["AGENT", "TEAMOWNER"].includes(productRole)

    if (userIsAgentType !== productIsAgentType) {
      return c.json(
        {
          success: "error" as const,
          error: "Cannot switch between AGENT and INVESTOR roles",
          code: "ROLE_INCOMPATIBLE",
        },
        400
      )
    }

    // Calculate prorated cost
    const proratedResponse = await fetch(`${config.api.route}/product/checkprorated`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": config.api.key,
      },
      body: JSON.stringify({
        product_id: productID,
        user_id: subscription.user_id,
      }),
    })
    const proratedCost: any = await proratedResponse.json()

    if (proratedCost.success !== "success") {
      throw new Error("Error fetching prorated cost")
    }
    responseBody.proratedCost = proratedCost.data

    return c.json(
      {
        success: "success" as const,
        data: responseBody,
      },
      200
    )
  } catch (error: any) {
    console.error(error)
    return c.json({ success: "error" as const, error: error.message }, 500)
  }
})

/**
 * GET /manage/checktoken/:token
 * Verifies JWT token and sets authentication cookies
 */
app.openapi(CheckTokenRoute, async (c) => {
  try {
    const { token } = c.req.valid("param")

    const decoded = jwt.verify(token, config.jwtSecret) as { id?: number }

    if (!decoded?.id) {
      throw new Error("Token not valid")
    }

    // Fetch user details
    const url = `${config.api.routeAuth}/users/${decoded.id}`
    const userResponse = await fetch(url, {
      headers: {
        "x-api-token": config.api.key,
      },
    })

    const user: any = await userResponse.json()

    if (user?.success !== "success") {
      throw new Error("Error fetching user")
    }

    if (!user?.data) {
      throw new Error("User not found")
    }

    // Get API token from user data
    const apiToken = user.data._api_token

    // Set authentication cookie
    if (apiToken) {
      setCookie(c, "_api_token", apiToken, {
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
        tokenValid: true,
        data: user.data,
      },
      200
    )
  } catch (error: any) {
    return c.json(
      {
        success: "error" as const,
        token: false,
        error: error.message,
      },
      500
    )
  }
})

/**
 * GET /manage/products
 * Fetches products filtered by user's role and whitelabel
 */
app.use("/products", authMiddleware(null))
app.openapi(GetProductsRoute, async (c) => {
  try {
    const user = c.get("user")

    // Determine compatible roles
    const userIsAgentType = ["AGENT", "TEAMOWNER"].includes(user.role)
    const compatibleRoles = userIsAgentType ? ["AGENT", "TEAMOWNER"] : ["INVESTOR"]

    // Resolve the user's whitelabel code for product filtering
    let userWhitelabelCode: string | null = null
    if (user.whitelabel_id) {
      const whitelabel = await db
        .selectFrom("Whitelabels")
        .select("code")
        .where("whitelabel_id", "=", user.whitelabel_id)
        .executeTakeFirst()
      userWhitelabelCode = whitelabel?.code ?? null
    }

    // Fetch products filtered by whitelabel_code — include products matching
    // the user's whitelabel or products with no whitelabel set (available to all)
    const allProducts = await db
      .selectFrom("Products")
      .selectAll()
      .$if(userWhitelabelCode !== null, (qb) =>
        qb.where((eb) =>
          eb.or([eb("whitelabel_code", "=", userWhitelabelCode!), eb("whitelabel_code", "is", null)])
        )
      )
      .execute()

    // Filter by role compatibility (still done in JS — no JSON path support in Kysely)
    const filteredProducts = allProducts.filter((product: any) => {
      const productRole = product.data?.user_config?.role

      // Check role compatibility (skip if product doesn't specify a role - backward compatibility)
      if (productRole && !compatibleRoles.includes(productRole)) {
        return false
      }

      return true
    })

    return c.json(
      {
        success: "success" as const,
        data: filteredProducts,
      },
      200
    )
  } catch (error: any) {
    console.error("Error in manage products API:", error)
    return c.json({ success: "error" as const, error: error.message }, 400)
  }
})

/**
 * GET /manage/whitelabels
 * Fetches all whitelabel branding data
 */
app.use("/whitelabels", authMiddleware(null))
app.openapi(GetWhitelabelsRoute, async (c) => {
  try {
    const whitelabels = await db.selectFrom("Whitelabels").selectAll().execute()

    // Transform to include branding data
    const whitelabelsWithBranding = whitelabels.map((wl: any) => ({
      whitelabel_id: wl.whitelabel_id,
      code: wl.code,
      name: wl.name,
      primary_color: wl.data?.primary_color || "#4d9cb9",
      secondary_color: wl.data?.secondary_color || "#ec8b33",
      logo_url: wl.data?.logo_url || "/assets/logos/default-logo.png",
    }))

    return c.json(
      {
        success: "success" as const,
        data: whitelabelsWithBranding,
      },
      200
    )
  } catch (error: any) {
    console.error("Error in manage whitelabels API:", error)
    return c.json({ success: "error" as const, error: error.message }, 400)
  }
})

/**
 * GET /manage/subscription/single
 * Fetches the user's active subscription
 */
app.use("/subscription/single", authMiddleware(null))
app.openapi(GetSubscriptionRoute, async (c) => {
  try {
    const user = c.get("user")

    // Fetch active subscription with product details
    const subscription = await db
      .selectFrom("Subscriptions")
      .innerJoin("Products", "Products.product_id", "Subscriptions.product_id")
      .selectAll()
      .where("Subscriptions.user_id", "=", user.user_id)
      .where("Subscriptions.status", "=", "active")
      .executeTakeFirst()

    if (!subscription) {
      return c.json(
        {
          success: "error" as const,
          error: "Subscription not found",
        },
        404
      )
    }

    return c.json(
      {
        success: "success" as const,
        data: subscription,
      },
      200
    )
  } catch (error: any) {
    console.error("Error in subscription/single API:", error)
    return c.json({ success: "error" as const, error: error.message }, 400)
  }
})

/**
 * POST /manage/updatecard
 * Updates the user's card on file
 */
app.use("/updatecard", authMiddleware(null))
app.openapi(UpdateCardRoute, async (c) => {
  try {
    const user = c.get("user")
    const body = c.req.valid("json")
    const { card_token, exp_month, exp_year } = body

    // TODO: Implement Square card update logic
    // This would typically:
    // 1. Find user's existing card
    // 2. Call Square API to update card
    // 3. Update UserCards table
    console.log(`Card update requested for user ${user.user_id}`)

    return c.json(
      {
        success: "success" as const,
        message: "Card updated successfully",
      },
      200
    )
  } catch (error: any) {
    console.error("Error in updatecard API:", error)
    return c.json({ success: "error" as const, error: error.message }, 400)
  }
})

/**
 * POST /manage/purchase
 * Changes the user's subscription plan
 */
app.use("/purchase", authMiddleware(null))
app.openapi(ManagePurchaseRoute, async (c) => {
  try {
    const user = c.get("user")
    const body = c.req.valid("json")
    const { product_id, subscription_id } = body
    const paymentContext = c.get("paymentContext")

    // 1. Fetch the new product to validate
    const newProduct = await db
      .selectFrom("Products")
      .selectAll()
      .where("product_id", "=", product_id)
      .executeTakeFirst()

    if (!newProduct) {
      return c.json(
        {
          success: "error" as const,
          error: "Product not found",
        },
        404
      )
    }

    // 2. Validate role compatibility
    const userIsAgentType = ["AGENT", "TEAMOWNER"].includes(user.role)
    const productData = newProduct.data as ProductData | null
    const productRole = productData?.user_config?.role
    const productIsAgentType = productRole ? ["AGENT", "TEAMOWNER"].includes(productRole) : false

    if (userIsAgentType !== productIsAgentType) {
      return c.json(
        {
          success: "error" as const,
          error: "Cannot switch between AGENT and INVESTOR roles",
          code: "ROLE_INCOMPATIBLE",
        },
        400
      )
    }

    // 3. Validate subscription_id is provided
    if (!subscription_id) {
      return c.json(
        {
          success: "error" as const,
          error: "subscription_id is required",
        },
        400
      )
    }

    // 4. Fetch current subscription
    const currentSubscription = await db
      .selectFrom("Subscriptions")
      .selectAll()
      .where("subscription_id", "=", subscription_id)
      .where("user_id", "=", user.user_id)
      .executeTakeFirst()

    if (!currentSubscription) {
      return c.json(
        {
          success: "error" as const,
          error: "Subscription not found",
        },
        404
      )
    }

    // 5. Calculate prorated charge
    const proratedResult = await calculateProratedUseCase.execute({
      productId: product_id,
      userId: user.user_id,
    })

    if (!proratedResult.success) {
      throw new Error(proratedResult.error || "Failed to calculate prorated cost")
    }

    const proratedAmount = proratedResult.data.proratedAmount

    // 6. Process payment if there's a charge
    let chargeDetails = null
    if (proratedAmount > 0) {
      const paymentResult = await createPaymentUseCase.execute({
        userId: user.user_id,
        amount: proratedAmount,
        email: user.email,
        memo: `Plan upgrade to ${newProduct.product_name}`,
        sendEmailOnCharge: true,
        context: paymentContext,
      })

      if (!paymentResult.success) {
        return c.json(
          {
            success: "error" as const,
            error: paymentResult.error || "Payment failed",
          },
          400
        )
      }

      chargeDetails = paymentResult.data
    }

    // 7. Update subscription with new product
    await db
      .updateTable("Subscriptions")
      .set({
        product_id: product_id,
        subscription_name: newProduct.product_name,
        amount: productData?.renewal_cost || newProduct.price,
        duration: productData?.duration,
        updatedAt: new Date(),
      })
      .where("subscription_id", "=", subscription_id)
      .execute()

    // Fetch updated subscription
    const updatedSubscription = await db
      .selectFrom("Subscriptions")
      .selectAll()
      .where("subscription_id", "=", subscription_id)
      .executeTakeFirst()

    return c.json(
      {
        success: "success" as const,
        data: {
          subscription: updatedSubscription,
          charge: chargeDetails,
        },
      },
      200
    )
  } catch (error: any) {
    console.error("Error in manage purchase API:", error)
    return c.json({ success: "error" as const, error: error.message }, 400)
  }
})

export const manageRoutes = app
