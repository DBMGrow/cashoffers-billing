import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import jwt from "jsonwebtoken"
import { CheckPlanRoute, CheckTokenRoute } from "./schemas/manage.schemas"

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

    if (!subscription) {
      throw new Error("Subscription required")
    }
    if (!productID) {
      throw new Error("productID required")
    }
    if (!apiToken) {
      throw new Error("api_token required")
    }

    const responseBody: any = {}

    // If team subscription, fetch team details
    if (subscription?.data?.team) {
      const headers = { "x-api-token": apiToken }

      const teamResponse = await fetch(
        `${process.env.API_ROUTE_AUTH}/teams/${subscription.data.team_id}`,
        { headers }
      )
      const team: any = await teamResponse.json()

      if (team.success !== "success") {
        throw new Error("Error fetching team")
      }
      responseBody.team = team.data

      const url = `${process.env.API_ROUTE_AUTH}/users?team_id=${subscription.data.team_id}&active=1`
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
    const productResponse = await fetch(
      `${process.env.API_ROUTE}/product/${productID}`,
      {
        headers: { "x-api-token": process.env.API_KEY! },
      }
    )
    const product: any = await productResponse.json()

    if (product.success !== "success") {
      throw new Error("Error fetching product")
    }
    responseBody.product = product.data

    // Calculate prorated cost
    const proratedResponse = await fetch(
      `${process.env.API_ROUTE}/product/checkprorated`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-token": process.env.API_KEY!,
        },
        body: JSON.stringify({
          product_id: productID,
          user_id: subscription.user_id,
        }),
      }
    )
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
    return c.json({ error: error.message }, 500)
  }
})

/**
 * GET /manage/checktoken/:token
 * Verifies JWT token and sets authentication cookies
 */
app.openapi(CheckTokenRoute, async (c) => {
  try {
    const { token } = c.req.valid("param")

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id?: number }

    if (!decoded?.id) {
      throw new Error("Token not valid")
    }

    // Fetch user details
    const url = `${process.env.API_ROUTE_AUTH}/users/${decoded.id}`
    const userResponse = await fetch(url, {
      headers: {
        "x-api-token": process.env.API_KEY!,
      },
    })

    const user: any = await userResponse.json()

    if (user?.success !== "success") {
      throw new Error("Error fetching user")
    }

    if (!user?.data) {
      throw new Error("User not found")
    }

    // TODO: Set authentication cookies here
    // setCookie(c, 'auth_token', token, { httpOnly: true, secure: true, sameSite: 'Lax' })

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

export const manageRoutes = app
