import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import axios from "axios"
import { PurchaseFreeRoute, CheckUserExistsRoute, CheckSlugExistsRoute } from "./schemas/signup.schemas"
import { db } from "@/api/lib/database"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

// Whitelabel mapping
const whitelabelIds: Record<string, number> = {
  default: 1,
  kw: 2,
  yhs: 3,
  iop: 4,
  uco: 5,
  mop: 6,
  eco: 7,
}

/**
 * POST /signup/purchasefree
 * Creates a new user account without a paid subscription
 */
app.openapi(PurchaseFreeRoute, async (c) => {
  try {
    const body = c.req.valid("json")

    const whitelabelId = whitelabelIds[body.whitelabel || "default"] ?? 1

    // Generate reset token
    const resetToken =
      Math.random().toString(36).substring(2, 10).toUpperCase() +
      Math.random().toString(36).substring(2, 10).toUpperCase()

    const role = body.isInvestor ? "INVITEDINVESTOR" : "AGENT"

    // Create user in auth API
    const response = await axios.post(
      process.env.API_ROUTE_AUTH + "/users",
      {
        email: body.email,
        name: body.name,
        phone: body.phone,
        name_broker: body.name_broker,
        name_team: body.name_team,
        slug: body.slug,
        role,
        reset_token: resetToken,
        is_premium: 0,
        whitelabel_id: whitelabelId,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-token": process.env.API_KEY!,
        },
      }
    )

    const data = response.data

    if (!data) {
      throw new Error("No data")
    }

    if (data.success !== "success" && data.success !== "warning") {
      throw new Error(JSON.stringify(data))
    }

    return c.json({ data }, 200)
  } catch (error: any) {
    console.error("Error in purchasefree API:", error.message)

    try {
      const data = JSON.parse(error.message)
      return c.json(
        {
          success: "error" as const,
          error: data.message,
          code: data?.code,
        },
        400
      )
    } catch {
      return c.json(
        {
          success: "error" as const,
          error: error.message,
        },
        400
      )
    }
  }
})

/**
 * GET /signup/checkuserexists/:email
 * Checks if a user exists and returns subscription/card status
 */
app.openapi(CheckUserExistsRoute, async (c) => {
  try {
    const { email } = c.req.valid("param")

    // Fetch user from auth API
    const user = await db.selectFrom("Users").selectAll().where("email", "=", email).executeTakeFirst()

    // User doesn't exist
    if (!user) {
      return c.json(
        {
          success: "success" as const,
          userExists: false,
        },
        200
      )
    }

    const isPremium = user.is_premium
    const active = user.active

    // Premium but inactive - offer downgrade
    if (isPremium && !active) {
      return c.json(
        {
          success: "success" as const,
          userExists: true,
          offerDowngrade: true,
        },
        200
      )
    }

    // Check card info
    const userInfo = await axios.get(`${process.env.API_ROUTE}/card/${user.user_id}/info`, {
      headers: {
        "x-api-token": process.env.API_KEY!,
      },
    })
    const userInfoJson: any = userInfo.data

    if (userInfoJson.success !== "success") {
      throw new Error("Something went wrong 2")
    }

    const response: any = {
      success: "success",
      userExists: true,
      hasCard: false,
    }

    if (userInfoJson.data?.has_card) {
      response.hasCard = true
    } else {
      // Determine if user can set up card and which plan
      if ((!user.team_id && user.user_id) || user.role === "TEAMOWNER") {
        response.canSetUpCard = true
        if (!user.team_id) response.plan = 1

        if (user.role === "TEAMOWNER") {
          const team = await axios.get(`${process.env.API_ROUTE_AUTH}/teams/${user.team_id}`, {
            headers: {
              "x-api-token": process.env.API_KEY!,
            },
          })
          const teamJson: any = team.data

          if (teamJson.success !== "success") {
            throw new Error("Something went wrong 3")
          }

          const teamSize = teamJson.data?.max_users

          if (teamSize <= 6) response.plan = 2
          else if (teamSize <= 10) response.plan = 3
          else if (teamSize <= 15) response.plan = 4
          else if (teamSize <= 20) response.plan = 5
          else if (teamSize <= 50) response.plan = 6
          else if (teamSize <= 75) response.plan = 7
          else if (teamSize <= 100) response.plan = 8
          else if (teamSize > 100) response.plan = 9
        }
      }
    }

    return c.json(response, 200)
  } catch (error: any) {
    return c.json({ success: "error" as const, error: error.message }, 400)
  }
})

/**
 * GET /signup/checkslugexists/:slug
 * Checks if a team slug is already taken
 */
app.openapi(CheckSlugExistsRoute, async (c) => {
  try {
    const { slug } = c.req.valid("param")

    const response = await axios.get(
      `${process.env.API_ROUTE_AUTH_V2}/client-site/checkslugexists/${encodeURIComponent(slug)}`,
      {
        headers: {
          "x-api-token": process.env.API_KEY!,
        },
      }
    )

    const json = response.data
    const data = json?.data

    if (data?.exists === false) {
      return c.json(
        {
          success: "success" as const,
          userExists: false,
        },
        200
      )
    }

    return c.json(
      {
        success: "success" as const,
        userExists: true,
      },
      200
    )
  } catch (error: any) {
    return c.json({ success: "error" as const, error: error.message }, 400)
  }
})

export const signupRoutes = app
