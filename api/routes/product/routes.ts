import { OpenAPIHono } from "@hono/zod-openapi"
import type { HonoVariables } from "@api/types/hono"
import { getContainer } from "@api/container"
import { authMiddleware } from "@/api/lib/middleware/authMiddleware"
import { GetProductRoute, GetAllProductsRoute, CreateProductRoute, CheckProratedRoute } from "./schemas"

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

// Apply auth middleware
app.use("/:product_id", authMiddleware("payments_read"))
app.use("/", authMiddleware("payments_read"))
app.use("/checkprorated", authMiddleware("payments_create"))

// Get single product by ID
app.openapi(GetProductRoute, async (c) => {
  const { product_id } = c.req.valid("param")
  const container = getContainer()

  const product = await container.repositories.product.findById(product_id)
  if (!product) throw new Error("No product found")

  return c.json({ success: "success" as const, data: product as any }, 200)
})

// Get all products with optional filters
app.openapi(GetAllProductsRoute, async (c) => {
  const container = getContainer()

  // TODO: Add support for filters and sorting
  const products = await container.repositories.product.findAll()

  return c.json({ success: "success" as const, data: products as any }, 200)
})

// Create new product
app.openapi(CreateProductRoute, async (c) => {
  const body = c.req.valid("json")
  const { product_name, product_description, product_type, price, data } = body

  const container = getContainer()
  const now = new Date()
  const product = await container.repositories.product.create({
    product_name,
    product_description,
    product_type,
    price,
    data: data as any,
    createdAt: now,
    updatedAt: now,
  })

  return c.json({ success: "success" as const, data: product as any }, 200)
})

// Check prorated amount
app.openapi(CheckProratedRoute, async (c) => {
  const body = c.req.valid("json")
  const container = getContainer()

  try {
    const result = await container.useCases.calculateProrated.execute({
      productId: Number(body.product_id),
      userId: Number(body.user_id),
    })

    if (!result.success) {
      return c.json(
        {
          success: "error" as const,
          error: result.error,
          code: result.code,
        },
        400
      )
    }

    // Return the full calculation result
    return c.json(
      {
        success: "success" as const,
        data: result.data as any,
      },
      200
    )
  } catch (error) {
    return c.json(
      {
        success: "error" as const,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    )
  }
})

export const productRoutes = app
