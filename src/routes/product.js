import express from "express"
import { Product } from "../database/Product"
import authMiddleware from "../middleware/authMiddleware"
import checkProrated from "../utils/checkProrated"

const router = express.Router()

router.get("/:product_id", authMiddleware("payments_read", { allowSelf: true }), async (req, res) => {
  const { product_id } = req.params

  const product = await Product.findOne({ where: { product_id } })
  if (!product) throw new Error("No product found")
  res.json({ success: "success", data: product })
})

router.get("/", authMiddleware("payments_read", { allowSelf: true }), async (req, res) => {
  const { sortby, direction, ...filters } = req.query

  const products = await Product.findAll({
    where: filters,
    // @ts-ignore
    order: sortby ? [[sortby, direction || "ASC"]] : undefined,
  })

  res.json({ success: "success", data: products })
})

router.post("/", authMiddleware("payments_create", { allowSelf: true }), async (req, res) => {
  const { product_name, product_description, product_type, price, data } = req.body

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

  res.json({ success: "success", data: product })
})

router.post("/checkprorated", authMiddleware("payments_create", { allowSelf: true }), async (req, res) => {
  const data = await checkProrated(req)
  res.json({ success: "success", data })
})

const productRoutes = router
export default productRoutes
