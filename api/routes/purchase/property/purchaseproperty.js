import authMiddleware from "../../../middleware/authMiddleware"
import express from "express"
const fetch = require("node-fetch")
import CodedError from "../../../config/CodedError"
import handleErrors from "../../../utils/handleErrors"
import chargeCardSingle from "../../../utils/chargeCardSingle"
import convertToFormata from "../../../utils/convertToFormdata"
import { Product } from "../../../database/Product"

const router = express.Router()

router.post("/:property_token", authMiddleware("properties_unlock", { allowSelf: true }), async (req, res) => {
  const { card_token } = req.body
  const { property_token } = req.params

  try {
    if (!property_token) throw new CodedError("property_token is required", "PURP01")

    const url = process.env.API_URL + "/properties/" + property_token + "/full"
    const propertyReq = await fetch(url, { headers: { "x-api-token": process.env.API_MASTER_TOKEN } })
    const property = await propertyReq.json()

    if (!property?.success) throw new CodedError("property not found", "PURP03")

    const productQuery = await Product.findOne({
      where: {
        product_name: "Property Unlock",
      },
    })

    if (!productQuery) throw new CodedError("`Property Unlock` product not found", "PURP04")
    const product = productQuery.get()

    const payment = await chargeCardSingle({
      body: {
        amount: 5000, // $50
        memo: `Unlocking property ${property_token} | ${property?.data?.address1} - ${property?.data?.city}, ${property?.data?.state}`,
        card_token,
        product_id: product?.product_id,
      },
      user: req.user,
    })
    if (payment?.success !== "success") throw new CodedError(JSON.stringify(payment), "PURP12")

    // update property to be unlocked
    const propertyUpdateReq = await fetch(url, {
      method: "PUT",
      headers: { "x-api-token": process.env.API_MASTER_TOKEN },
      body: convertToFormata({ is_unlocked: 2 }),
    })
    const propertyUpdate = await propertyUpdateReq.json()
    if (propertyUpdate?.success !== "success") throw new CodedError(JSON.stringify(propertyUpdate), "PURP13")

    res.json({ success: "success" })
  } catch (error) {
    return handleErrors(req, res, error)
  }
})

const purchasePropertyRoutes = router
export default purchasePropertyRoutes
