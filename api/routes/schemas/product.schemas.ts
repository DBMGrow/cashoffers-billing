import { z } from "zod"
import {
  SuccessResponseSchema,
  ErrorResponseSchema,
  ProductIdParamSchema,
  AmountSchema,
} from "./common.schemas"

/**
 * Product route schemas
 * Handles product CRUD and prorated calculations
 */

// ==================== Enums ====================

export const ProductTypeSchema = z.enum(["none", "one-time", "subscription"])

// ==================== Request Schemas ====================

/**
 * Create product request body
 */
export const CreateProductRequestSchema = z.object({
  product_name: z.string().min(1, "Product name is required"),
  product_description: z.string().optional(),
  product_type: ProductTypeSchema,
  price: z.number(),
  data: z.record(z.string(), z.any()).optional(),
})

/**
 * Check prorated request body (existing subscription upgrade/downgrade calculation)
 */
export const CheckProratedRequestSchema = z.object({
  // Fields depend on checkProrated utility - keeping flexible
  subscription_id: z.number().optional(),
  new_amount: z.number().optional(),
  user_id: z.number().optional(),
}).passthrough() // Allow additional fields

// ==================== Response Schemas ====================

/**
 * Product object
 */
export const ProductSchema = z.object({
  product_id: z.number(),
  product_name: z.string(),
  product_description: z.string().nullable(),
  product_type: z.string(),
  price: z.number(),
  data: z.record(z.string(), z.any()).nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
})

/**
 * Get single product response
 */
export const GetProductResponseSchema = SuccessResponseSchema(ProductSchema)

/**
 * Get all products response
 */
export const GetAllProductsResponseSchema = SuccessResponseSchema(z.array(ProductSchema))

/**
 * Create product response
 */
export const CreateProductResponseSchema = SuccessResponseSchema(ProductSchema)

/**
 * Check prorated response
 */
export const CheckProratedResponseSchema = SuccessResponseSchema(
  z.object({
    proratedAmount: z.number(),
    daysRemaining: z.number().optional(),
    oldAmount: z.number().optional(),
    newAmount: z.number().optional(),
  }).passthrough() // Allow additional fields from checkProrated utility
)

// ==================== OpenAPI Route Definitions ====================

/**
 * GET /product/:product_id - Get single product
 */
export const GetProductRoute = {
  method: "get" as const,
  path: "/{product_id}",
  request: {
    params: ProductIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: GetProductResponseSchema,
        },
      },
      description: "Returns product details",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or product not found",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Products"],
  summary: "Get product by ID",
  description: "Retrieve details of a specific product. Requires payments_read permission.",
}

/**
 * GET /product - Get all products
 */
export const GetAllProductsRoute = {
  method: "get" as const,
  path: "/",
  request: {},
  responses: {
    200: {
      content: {
        "application/json": {
          schema: GetAllProductsResponseSchema,
        },
      },
      description: "Returns list of all products",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Products"],
  summary: "Get all products",
  description: "Retrieve list of all products. Requires payments_read permission.",
}

/**
 * POST /product - Create new product
 */
export const CreateProductRoute = {
  method: "post" as const,
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateProductRequestSchema,
          example: {
            product_name: "Premium Subscription",
            product_description: "Monthly premium access",
            product_type: "subscription",
            price: 29.99,
            data: { features: ["feature1", "feature2"] },
          },
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CreateProductResponseSchema,
        },
      },
      description: "Product created successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or validation error",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Products"],
  summary: "Create product",
  description:
    "Create a new product. Product type can be 'none', 'one-time', or 'subscription'. Requires payments_create permission.",
}

/**
 * POST /product/checkprorated - Calculate prorated amount
 */
export const CheckProratedRoute = {
  method: "post" as const,
  path: "/checkprorated",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CheckProratedRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CheckProratedResponseSchema,
        },
      },
      description: "Returns prorated calculation",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Bad request or calculation error",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Internal server error",
    },
  },
  tags: ["Products"],
  summary: "Calculate prorated amount",
  description:
    "Calculate prorated charge when upgrading/downgrading subscriptions. Requires payments_create permission.",
}
