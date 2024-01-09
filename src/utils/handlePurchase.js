import { Product } from "../database/Product"
import createNewSubscription from "./createNewSubscription"
import updateExistingSubscription from "./updateExistingSubscription"
import CodedError from "../config/CodedError"

export default async function handlePurchase(product_id, user, userIsSubscribed, userWithEmailExists) {
  try {
    const product = await Product.findOne({ where: { product_id } })
    if (!product) throw new CodedError("product not found", "HPUR01")

    switch (product.product_type) {
      case "subscription":
        if (userIsSubscribed) return await updateExistingSubscription(product, user)
        return await createNewSubscription(product, user, userWithEmailExists)
    }

    throw new CodedError("invalid product_type", "HPUR02")
  } catch (error) {
    return { success: "error", error: error.message }
  }
}
