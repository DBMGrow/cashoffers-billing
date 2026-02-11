import { Hono } from "hono"
import type { HonoVariables } from "@/types/hono"
import { getContainer } from "@/container"
import { authMiddleware } from "@/middleware/authMiddleware"
import checkProrated from "@/utils/checkProrated"

const app = new Hono<{ Variables: HonoVariables }>()

// Get single product by ID
app.get(
  "/:product_id",
  authMiddleware("payments_read"),
  async (c) => {
    const { product_id } = c.req.param()
    const container = getContainer()

    const product = await container.repositories.product.findById(parseInt(product_id, 10))
    if (!product) throw new Error("No product found")

    return c.json({ success: "success", data: product })
  }
)

// Get all products with optional filters
app.get("/", authMiddleware("payments_read"), async (c) => {
  const query = c.req.query()
  const container = getContainer()

  // TODO: Add support for filters and sorting
  const products = await container.repositories.product.findAll()

  return c.json({ success: "success", data: products })
})

// Create new product
app.post("/", authMiddleware("payments_create"), async (c) => {
  const body = await c.req.json()
  const { product_name, product_description, product_type, price, data } = body

  if (!product_name) throw new Error("product_name is required")
  if (!product_type) throw new Error("product_type is required")
  if (typeof price !== "number") throw new Error("price is required")
  if (data && typeof data !== "object") throw new Error("data must be valid json")

  const container = getContainer()
  const now = new Date()
  const product = await container.repositories.product.create({
    product_name,
    product_description,
    product_type,
    price,
    data,
    createdAt: now,
    updatedAt: now,
  })

  return c.json({ success: "success", data: product })
})

// Check prorated amount
app.post(
  "/checkprorated",
  authMiddleware("payments_create"),
  async (c) => {
    // Create mock request for checkProrated compatibility
    const body = await c.req.json()
    const mockReq = {
      body,
      headers: Object.fromEntries(c.req.raw.headers.entries()),
    }

    const data = await checkProrated(mockReq as any)
    return c.json({ success: "success", data })
  }
)

export const productRoutes = app
