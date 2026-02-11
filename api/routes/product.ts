import { Hono } from "hono"
import type { HonoVariables } from "../../types/hono"
import { Product } from "../../database/Product"
import { authMiddleware } from "../../middleware/authMiddleware"
import checkProrated from "../../utils/checkProrated"

const app = new Hono<{ Variables: HonoVariables }>()

// Get single product by ID
app.get(
  "/:product_id",
  authMiddleware("payments_read"),
  async (c) => {
    const { product_id } = c.req.param()

    const product = await Product.findOne({ where: { product_id } })
    if (!product) throw new Error("No product found")

    return c.json({ success: "success", data: product })
  }
)

// Get all products with optional filters
app.get("/", authMiddleware("payments_read"), async (c) => {
  const query = c.req.query()
  const { sortby, direction, ...filters } = query

  const products = await Product.findAll({
    where: filters,
    // @ts-ignore
    order: sortby ? [[sortby, direction || "ASC"]] : undefined,
  })

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

  const product = await Product.create({
    product_name,
    product_description,
    product_type,
    price,
    data,
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
