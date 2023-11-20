import { Product } from "../database/Product"
import createNewSubscription from "./createNewSubscription"
import CodedError from "../config/CodedError"

export default async function handlePurchase(product_id, user) {
  try {
    console.log("HANDLE_PURCHASE", { product_id, user })

    const product = await Product.findOne({ where: { product_id } })
    if (!product) throw new CodedError("product not found", "HPUR01")

    switch (product.product_type) {
      case "subscription":
        return await createNewSubscription(product, user)
    }

    throw new CodedError("invalid product_type", "HPUR02")
  } catch (error) {
    return { success: "error", error: error.message }
  }
}
