import express from "express"
import { Product } from "../database/Product"
import authMiddleware from "../middleware/authMiddleware"
import checkProrated from "../utils/checkProrated"

const router = express.Router()

router.get("/:product_id", authMiddleware("payments_read", { allowSelf: true }), async (req, res) => {
  const { product_id } = req.params
  try {
    const product = await Product.findOne({ where: { product_id } })
    if (!product) throw new Error("No product found")
    res.json({ success: "success", data: product })
  } catch (error) {
    res.json({ success: "error", error: error.message })
  }
})

router.get("/", authMiddleware("payments_read", { allowSelf: true }), async (req, res) => {
  const { sortby, direction, ...filters } = req.query

  try {
    const products = await Product.findAll({
      where: filters,
      order: sortby ? [[sortby, direction || "ASC"]] : undefined,
    })

    res.json({ success: "success", data: products })
  } catch (error) {
    res.json({ success: "error", error: error.message })
  }
})

router.post("/", authMiddleware("payments_create", { allowSelf: true }), async (req, res) => {
  const { product_name, product_description, product_type, price, data } = req.body

  try {
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
  } catch (error) {
    res.json({ success: "error", error: error.message })
  }
})

router.post("/checkprorated", authMiddleware("payments_create", { allowSelf: true }), async (req, res) => {
  try {
    const data = await checkProrated(req)
    res.json({ success: "success", data })
  } catch (error) {
    res.json({ success: "error", error: error.message })
  }
})

const productRoutes = router
export default productRoutes
