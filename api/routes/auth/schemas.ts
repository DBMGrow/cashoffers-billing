import { z } from "zod"
import { ErrorResponseSchema, EmailSchema } from "@api/routes/helpers/common.schemas"

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
})

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
  description: "Authenticates user and sets authentication cookies. Proxies to auth v2 API for user verification.",
}

/**
 * GET /auth/check - Check current session
 */
export const CheckAuthRoute = {
  method: "get" as const,
  path: "/check",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: LoginResponseSchema,
        },
      },
      description: "Session is valid, returns current user",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Not authenticated",
    },
  },
  tags: ["Auth"],
  summary: "Check current session",
  description: "Returns the authenticated user based on the session cookie.",
}

/**
 * GET /auth/jwt/verify/:token - Verify JWT token
 */
export const VerifyJwtRoute = {
  method: "get" as const,
  path: "/jwt/verify/:token",
  request: {
    params: z.object({
      token: z.string().min(1),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: LoginResponseSchema,
        },
      },
      description: "Token is valid, returns user data",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Invalid or expired token",
    },
  },
  tags: ["Auth"],
  summary: "Verify JWT token",
  description: "Verifies a JWT token locally and returns the associated user.",
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
