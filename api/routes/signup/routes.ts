import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import axios from "axios"
import { config } from "@api/config/config.service"
import {
  CheckUserExistsRoute,
  CheckSlugExistsRoute,
  SendReactivationRoute,
  GetProductsRoute,
  GetWhitelabelsRoute,
  GetUniqueSlugRoute,
} from "./schemas"
import { db } from "@api/lib/database"
import { checkSlugExists } from "./utils"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

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

    // v2 responds 200 {exists:false} when the slug is free and 400 (CodedError)
    // when it's taken — treat the 400 as "exists" rather than an error.
    const response = await axios.get(
      `${config.api.urlV2}/client-site/checkslugexists/${encodeURIComponent(slug)}`,
      {
        headers: {
          "x-api-token": config.api.key,
        },
        validateStatus: (status) => status < 500,
      }
    )

    const json = response.data
    const data = json?.data

    if (response.status === 200 && data?.exists === false) {
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
 * Thin proxy to the main API's reactivation endpoint, which owns the
 * token generation, persistence, and email delivery.
 */
app.openapi(SendReactivationRoute, async (c) => {
  try {
    const { email } = c.req.valid("json")

    await axios.post(
      `${config.api.urlV2}/signup/reactivate/sendrequest`,
      { email },
      { headers: { "Content-Type": "application/json" } }
    )

    return c.json(
      {
        success: "success" as const,
        message: "Reactivation email sent successfully",
      },
      200
    )
  } catch (error: any) {
    const upstreamMessage = error?.response?.data?.error || error?.response?.data?.message
    const message = upstreamMessage || error?.message || "Failed to send reactivation email"
    console.error("Error proxying sendreactivation to main API:", message)
    return c.json({ success: "error" as const, error: message }, 400)
  }
})

/**
 * GET /signup/products
 * Fetches all active products filtered by whitelabel.
 * Returns 404 if the whitelabel code is not found.
 * Excludes external_cashoffers products — those are only available via the manage flow.
 */
app.openapi(GetProductsRoute, async (c) => {
  try {
    const query = c.req.valid("query")
    const whitelabelCode = query.whitelabel || "default"

    // Validate whitelabel exists — 404 if not found
    const whitelabel = await db
      .selectFrom("Whitelabels")
      .select("whitelabel_id")
      .where("code", "=", whitelabelCode)
      .executeTakeFirst()

    if (!whitelabel) {
      return c.json(
        {
          success: "error" as const,
          error: "Whitelabel not found",
          code: "WHITELABEL_NOT_FOUND",
        },
        404
      )
    }

    // Filter by whitelabel_code — include products matching the code
    // or products with no code set (available for all whitelabels).
    // Exclude external_cashoffers — those are managed via /purchase/existing, not signup.
    const filteredProducts = await db
      .selectFrom("Products")
      .selectAll()
      .where("product_category", "!=", "external_cashoffers")
      .where((eb) =>
        eb.or([eb("whitelabel_code", "=", whitelabelCode), eb("whitelabel_code", "is", null)])
      )
      .execute()

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
      marketing_website: wl.data?.marketing_website || "/",
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
