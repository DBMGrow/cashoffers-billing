import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import { db } from "@api/lib/database"
import { z } from "zod"
import { createRoute } from "@hono/zod-openapi"
import jwt from "jsonwebtoken"
import { config } from "@api/config/config.service"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

/**
 * Generate a test API token (JWT)
 */
function generateTestToken(userId: number, email: string): string {
  return jwt.sign({ id: userId, email }, config.jwtSecret, { expiresIn: "24h" })
}

/**
 * Generate a random string for various test purposes
 */
function generateRandomString(length: number = 16): string {
  return Math.random()
    .toString(36)
    .substring(2, length + 2)
    .toUpperCase()
}

// Only enable test endpoints in non-production environments
if (config.nodeEnv !== "production") {
  /**
   * POST /test/create-user
   * Creates a test user in the database
   */
  const CreateUserRoute = createRoute({
    method: "post",
    path: "/create-user",
    tags: ["Test Helpers"],
    summary: "Create test user",
    description: "Creates a test user for E2E testing (DEV/TEST only)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              email: z.string().email(),
              name: z.string(),
              phone: z.string().optional(),
              role: z.enum(["AGENT", "INVESTOR", "ADMIN", "TEAMOWNER"]).optional(),
              whitelabel_id: z.number().optional(),
              is_premium: z.number().min(0).max(1).optional(),
              active: z.number().min(0).max(1).optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "User created successfully",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal("success"),
              data: z.object({
                user_id: z.number(),
                email: z.string(),
                api_token: z.string(),
              }),
            }),
          },
        },
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal("error"),
              error: z.string(),
            }),
          },
        },
      },
    },
  })

  app.openapi(CreateUserRoute, async (c) => {
    try {
      const body = c.req.valid("json")

      // Check if user already exists
      const existingUser = await db
        .selectFrom("Users")
        .select("user_id")
        .where("email", "=", body.email)
        .executeTakeFirst()

      if (existingUser) {
        return c.json(
          {
            success: "error" as const,
            error: "User with this email already exists",
          },
          400
        )
      }

      // Create user in Users table
      const result = await db
        .insertInto("Users")
        .values({
          email: body.email,
          name: body.name,
          phone: body.phone || null,
          role: body.role || "AGENT",
          whitelabel_id: body.whitelabel_id || 1,
          is_premium: body.is_premium || 0,
          active: body.active ?? 1,
          api_token: null, // Will be set later if needed
        })
        .executeTakeFirstOrThrow()

      const userId = Number(result.insertId)

      // Generate API token
      const apiToken = generateTestToken(userId, body.email)

      return c.json({
        success: "success" as const,
        data: {
          user_id: userId,
          email: body.email,
          api_token: apiToken,
        },
      })
    } catch (error: any) {
      console.error("Error creating test user:", error)
      return c.json(
        {
          success: "error" as const,
          error: error.message || "Failed to create test user",
        },
        400
      )
    }
  })

  /**
   * POST /test/create-subscription
   * Creates a test subscription
   */
  const CreateSubscriptionRoute = createRoute({
    method: "post",
    path: "/create-subscription",
    tags: ["Test Helpers"],
    summary: "Create test subscription",
    description: "Creates a test subscription for E2E testing (DEV/TEST only)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              user_id: z.number(),
              product_id: z.number(),
              amount: z.number(),
              status: z.string().optional(),
              subscription_name: z.string().optional(),
              duration: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
              renewal_date: z.string().optional(), // ISO date string
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Subscription created successfully",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal("success"),
              data: z.object({
                subscription_id: z.number(),
              }),
            }),
          },
        },
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal("error"),
              error: z.string(),
            }),
          },
        },
      },
    },
  })

  app.openapi(CreateSubscriptionRoute, async (c) => {
    try {
      const body = c.req.valid("json")

      // Verify user exists
      const user = await db
        .selectFrom("Users")
        .select("user_id")
        .where("user_id", "=", body.user_id)
        .executeTakeFirst()

      if (!user) {
        return c.json(
          {
            success: "error" as const,
            error: "User not found",
          },
          400
        )
      }

      // Calculate renewal date (30 days from now by default)
      const renewalDate = body.renewal_date
        ? new Date(body.renewal_date)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      const now = new Date()
      const result = await db
        .insertInto("Subscriptions")
        .values({
          user_id: body.user_id,
          product_id: body.product_id,
          amount: body.amount,
          status: body.status || "active",
          subscription_name: body.subscription_name || "Test Subscription",
          duration: body.duration || "monthly",
          renewal_date: renewalDate,
          createdAt: now,
          updatedAt: now,
        })
        .executeTakeFirstOrThrow()

      return c.json({
        success: "success" as const,
        data: {
          subscription_id: Number(result.insertId),
        },
      }, 200)
    } catch (error: any) {
      console.error("Error creating test subscription:", error)
      return c.json(
        {
          success: "error" as const,
          error: String(error.message || "Failed to create test subscription"),
        },
        400
      )
    }
  })

  /**
   * DELETE /test/cleanup-user
   * Removes test user and all related data
   */
  const CleanupUserRoute = createRoute({
    method: "delete",
    path: "/cleanup-user",
    tags: ["Test Helpers"],
    summary: "Cleanup test user",
    description:
      "Removes test user and all related data (DEV/TEST only)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              email: z.string().email(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "User cleaned up successfully",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal("success"),
              message: z.string(),
              data: z
                .object({
                  user_id: z.number(),
                  deleted_transactions: z.number(),
                  deleted_subscriptions: z.number(),
                  deleted_cards: z.number(),
                })
                .optional(),
            }),
          },
        },
      },
    },
  })

  app.openapi(CleanupUserRoute, async (c) => {
    try {
      const { email } = c.req.valid("json")

      // Get user ID
      const user = await db
        .selectFrom("Users")
        .select("user_id")
        .where("email", "=", email)
        .executeTakeFirst()

      if (!user) {
        return c.json({
          success: "success" as const,
          message: "User not found (already cleaned up or never existed)",
        })
      }

      // Delete related data (in order of foreign key dependencies)
      const deletedTransactions = await db
        .deleteFrom("Transactions")
        .where("user_id", "=", user.user_id)
        .execute()

      const deletedSubscriptions = await db
        .deleteFrom("Subscriptions")
        .where("user_id", "=", user.user_id)
        .execute()

      const deletedCards = await db
        .deleteFrom("UserCards")
        .where("user_id", "=", user.user_id)
        .execute()

      // Finally, delete the user
      await db
        .deleteFrom("Users")
        .where("user_id", "=", user.user_id)
        .execute()

      return c.json({
        success: "success" as const,
        message: "User and related data cleaned up successfully",
        data: {
          user_id: user.user_id,
          deleted_transactions: Number(deletedTransactions[0]?.numDeletedRows || 0),
          deleted_subscriptions: Number(deletedSubscriptions[0]?.numDeletedRows || 0),
          deleted_cards: Number(deletedCards[0]?.numDeletedRows || 0),
        },
      })
    } catch (error: any) {
      console.error("Error cleaning up test user:", error)
      return c.json(
        {
          success: "error" as const,
          error: error.message || "Failed to cleanup test user",
        },
        400
      )
    }
  })

  console.log("⚠️  Test helper endpoints enabled (non-production environment)")
} else {
  // In production, return 404 for all test routes
  app.all("/*", (c) => {
    return c.json(
      {
        success: "error" as const,
        error: "Test endpoints are disabled in production",
      },
      404
    )
  })
}

export const testRoutes = app
