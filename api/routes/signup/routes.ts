import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import axios from "axios"
import { createElement } from "react"
import { render } from "@react-email/render"
import { config } from "@api/config/config.service"
import AccountReactivationEmail from "@api/infrastructure/email/templates/account-reactivation.email"
import {
  PurchaseFreeRoute,
  CheckUserExistsRoute,
  CheckSlugExistsRoute,
  SendReactivationRoute,
  GetProductsRoute,
  GetWhitelabelsRoute,
  GetUniqueSlugRoute,
} from "./schemas"
import { db } from "@api/lib/database"
import { setCookie } from "hono/cookie"
import { emailService } from "@api/lib/services"
import { checkSlugExists } from "./utils"

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
      config.api.routeAuth + "/users",
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
          "x-api-token": config.api.key,
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

    // Extract API token from response and set cookie
    if (data.data?._api_token) {
      setCookie(c, "_api_token", data.data._api_token, {
        httpOnly: true,
        secure: config.nodeEnv === "production",
        sameSite: "Lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
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
    console.log("CheckUserExists called with email:", email)

    // Fetch user from auth API
    const user = await db.selectFrom("Users").selectAll().where("email", "=", email).executeTakeFirst()
    console.log("User query result:", user ? "User found" : "User not found")

    // User doesn't exist
    if (!user) {
      console.log("Returning userExists: false")
      return c.json(
        {
          success: "success" as const,
          userExists: false,
        },
        200
      )
    }

    console.log(
      "User exists, checking status. user_id:",
      user.user_id,
      "is_premium:",
      user.is_premium,
      "active:",
      user.active
    )

    const isPremium = user.is_premium
    const active = user.active

    // Premium but inactive - offer downgrade
    if (isPremium && !active) {
      console.log("Returning offerDowngrade: true")
      return c.json(
        {
          success: "success" as const,
          userExists: true,
          offerDowngrade: true,
        },
        200
      )
    }

    console.log("Checking card and team info...")

    // Check card info from database
    const userCard = await db.selectFrom("UserCards").selectAll().where("user_id", "=", user.user_id).executeTakeFirst()

    const response: any = {
      success: "success",
      userExists: true,
      hasCard: false,
    }

    if (userCard) {
      response.hasCard = true
    } else {
      // Determine if user can set up card and which plan
      if ((!user.team_id && user.user_id) || user.role === "TEAMOWNER") {
        response.canSetUpCard = true
        if (!user.team_id) response.plan = 1

        if (user.role === "TEAMOWNER" && user.team_id) {
          const team = await db
            .selectFrom("Teams")
            .select(["max_users"])
            .where("team_id", "=", user.team_id)
            .executeTakeFirst()

          if (!team) {
            throw new Error("Team not found")
          }

          const teamSize = team.max_users

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

    console.log("Returning final response:", JSON.stringify(response))
    return c.json(response, 200)
  } catch (error: any) {
    console.error("Error in checkuserexists API:", error)
    const errorMessage = error?.message || error?.toString() || "Unknown error occurred"
    return c.json({ success: "error" as const, error: errorMessage }, 400)
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
      `${config.api.routeAuthV2}/client-site/checkslugexists/${encodeURIComponent(slug)}`,
      {
        headers: {
          "x-api-token": config.api.key,
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

/**
 * POST /signup/sendreactivation
 * Sends reactivation email to inactive premium users
 */
app.openapi(SendReactivationRoute, async (c) => {
  try {
    const body = c.req.valid("json")
    const { email } = body

    // Fetch user from database
    const user = await db.selectFrom("Users").selectAll().where("email", "=", email).executeTakeFirst()

    if (!user) {
      return c.json(
        {
          success: "error" as const,
          error: "User not found",
        },
        400
      )
    }

    // Verify user can downgrade (is_premium && !active)
    if (!user.is_premium || user.active) {
      return c.json(
        {
          success: "error" as const,
          error: "User is not eligible for reactivation",
        },
        400
      )
    }

    // Generate reactivation token
    const reactivationToken =
      Math.random().toString(36).substring(2, 10).toUpperCase() +
      Math.random().toString(36).substring(2, 10).toUpperCase()

    // Build reactivation URL
    const reactivationUrl = `${config.app.url}/subscribe?reactivation_token=${reactivationToken}&email=${encodeURIComponent(email)}`

    // Send reactivation email
    const html = await render(
      createElement(AccountReactivationEmail, {
        name: user.name || "User",
        reactivationUrl,
      })
    )
    await emailService.sendEmail({
      to: email,
      subject: "Reactivate Your CashOffers Account",
      html,
      templateName: "account-reactivation",
    })

    console.log(`Reactivation email sent to ${email} with token ${reactivationToken}`)

    return c.json(
      {
        success: "success" as const,
        message: "Reactivation email sent successfully",
      },
      200
    )
  } catch (error: any) {
    console.error("Error in sendreactivation API:", error)
    return c.json({ success: "error" as const, error: error.message }, 400)
  }
})

/**
 * GET /signup/products
 * Fetches all active products filtered by whitelabel
 */
app.openapi(GetProductsRoute, async (c) => {
  try {
    const query = c.req.valid("query")
    const whitelabelCode = query.whitelabel || "default"
    const whitelabelId = whitelabelIds[whitelabelCode] ?? 1

    // Fetch all products and filter in JavaScript
    const allProducts = await db.selectFrom("Products").selectAll().execute()

    const filteredProducts = allProducts.filter((product: any) => {
      const productWhitelabelId = product.data?.user_config?.whitelabel_id
      // Include products that:
      // 1. Have a whitelabel_id that matches the requested one
      // 2. Don't have a whitelabel_id set (backward compatibility - available for all whitelabels)
      return productWhitelabelId === whitelabelId || productWhitelabelId === undefined || productWhitelabelId === null
    })

    return c.json(
      {
        success: "success" as const,
        data: filteredProducts,
      },
      200
    )
  } catch (error: any) {
    console.error("Error in products API:", error)
    return c.json({ success: "error" as const, error: error.message }, 400)
  }
})

/**
 * GET /signup/whitelabels
 * Fetches all whitelabel branding data
 */
app.openapi(GetWhitelabelsRoute, async (c) => {
  try {
    // Fetch whitelabels from database
    const whitelabels = await db.selectFrom("Whitelabels").selectAll().execute()

    // Transform to include branding data
    // Note: The 'data' field will be added in Phase 4 migration
    // For now, we return basic info with placeholder branding
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
    console.error("Error in whitelabels API:", error)
    return c.json({ success: "error" as const, error: error.message }, 400)
  }
})

app.openapi(GetUniqueSlugRoute, async (c) => {
  const name = c.req.valid("query").name

  try {
    let uniqueSlug = name.toLowerCase().replace(/ /g, "")
    uniqueSlug = await checkSlugExists(uniqueSlug)
    return c.json({ success: "success" as const, data: { slug: uniqueSlug } }, 200)
  } catch (error: any) {
    console.error("Error in getuniqueslug API:", error)
    return c.json({ success: "error" as const, error: error.message }, 400)
  }
})

export const signupRoutes = app
