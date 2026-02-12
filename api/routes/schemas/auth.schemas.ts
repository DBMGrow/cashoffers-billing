import { z } from "zod"
import { ErrorResponseSchema, EmailSchema } from "./common.schemas"

/**
 * Auth route schemas
 * Handles user authentication
 */

// ==================== Request Schemas ====================

/**
 * Login request body
 */
export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, "Password is required"),
})

// ==================== Response Schemas ====================

/**
 * User details in response
 */
export const UserResponseSchema = z.object({
  user_id: z.number(),
  email: z.string(),
  name: z.string().optional(),
  phone: z.string().nullable().optional(),
  role: z.string().optional(),
  active: z.union([z.number(), z.boolean()]).optional(),
  is_premium: z.union([z.number(), z.boolean()]).optional(),
  team_id: z.number().nullable().optional(),
  whitelabel_id: z.number().nullable().optional(),
  // Allow additional fields
}).passthrough()

/**
 * Login response
 */
export const LoginResponseSchema = z.object({
  success: z.literal("success"),
  data: UserResponseSchema,
})

/**
 * Logout response
 */
export const LogoutResponseSchema = z.object({
  success: z.literal("success"),
  message: z.string(),
})

// ==================== OpenAPI Route Definitions ====================

/**
 * POST /auth/login - User login
 */
export const LoginRoute = {
  method: "post" as const,
  path: "/login",
  request: {
    body: {
      content: {
        "application/json": {
          schema: LoginRequestSchema,
          example: {
            email: "user@example.com",
            password: "password123",
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: LoginResponseSchema,
        },
      },
      description: "Login successful",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Invalid credentials or bad request",
    },
  },
  tags: ["Auth"],
  summary: "User login",
  description:
    "Authenticates user and sets authentication cookies. Proxies to auth v2 API for user verification.",
}

/**
 * POST /auth/logout - User logout
 */
export const LogoutRoute = {
  method: "post" as const,
  path: "/logout",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: LogoutResponseSchema,
        },
      },
      description: "Logout successful",
    },
  },
  tags: ["Auth"],
  summary: "User logout",
  description: "Clears authentication cookies and logs the user out.",
}
