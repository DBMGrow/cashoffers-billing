import authMiddleware from "../../../middleware/authMiddleware"
import express from "express"
const fetch = require("node-fetch")
import CodedError from "../../../config/CodedError"
import handleErrors from "../../../utils/handleErrors"
import chargeCardSingle from "../../../utils/chargeCardSingle"

const router = express.Router()

router.post("/:property_token", authMiddleware("payments_create", { allowSelf: true }), async (req, res) => {
  const { card_token } = req.body
  const { property_token } = req.params

  try {
    if (!property_token) throw new CodedError("product_id is required", "PURP01")
    if (!email) throw new CodedError("email is required", "PURP02")

    const url = process.env.API_URL + "/properties/" + property_token
    const propertyReq = await fetch(url, { headers: { "x-api-token": process.env.API_MASTER_TOKEN } })
    const property = await propertyReq.json()
    if (!property?.data?.success) throw new CodedError("property not found", "PURP03")

    const payment = await chargeCardSingle({
      body: {
        amount: 5000, // $50
        memo: "Purchase of " + product?.dataValues?.product_name,
        card_token,
      },
      user: { email },
    })
    if (payment?.success !== "success") throw new CodedError(JSON.stringify(payment), "PURP12")

    // update property to be unlocked
    const propertyUpdateReq = await fetch(url, {
      method: "PUT",
      headers: { "x-api-token": process.env.API_MASTER_TOKEN },
      body: convertToFormata({ is_unlocked: 1 }),
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
