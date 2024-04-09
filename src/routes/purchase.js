import authMiddleware from "../middleware/authMiddleware"
import express from "express"
const fetch = require("node-fetch")
import CodedError from "../config/CodedError"
import convertToFormata from "../utils/convertToFormdata"
import handleErrors from "../utils/handleErrors"
import createCard from "../utils/createCard"
import createPayment from "../utils/createPayment"
import handlePurchase from "../utils/handlePurchase"
import { Product } from "../database/Product"
import { UserCard } from "../database/UserCard"
import { Subscription } from "../database/Subscription"
import checkProrated from "../utils/checkProrated"

const router = express.Router()

router.post("/", authMiddleware("payments_create", { allowSelf: true }), async (req, res) => {
  const {
    product_id,
    email,
    coupon,
    phone,
    card_token,
    exp_month,
    exp_year,
    cardholder_name,
    api_token,
    whitelabel,
    slug,
  } = req.body

  try {
    if (!product_id) throw new CodedError("product_id is required", "PUR01")
    if (!email) throw new CodedError("email is required", "PUR02")

    const product = await Product.findOne({ where: { product_id } })
    if (!product) throw new CodedError("product not found", "PUR03")

    const url = process.env.API_URL + "/users?email=" + encodeURIComponent(email)
    const userWithEmail = await fetch(url, { headers: { "x-api-token": process.env.API_MASTER_TOKEN } })
    const userWithEmailData = await userWithEmail.json()
    const userWithEmailExists = userWithEmailData?.data?.length > 0

    let user = { ...userWithEmailData?.data?.[0] }
    let user_id = user?.user_id
    let userCard
    let newUser
    let userIsSubscribed = false

    if (userWithEmailExists) {
      if (!api_token) throw new CodedError("api_token is required", "PUR04")
      userCard = await UserCard.findOne({ where: { user_id: user?.user_id } })
      const userHasBilling = userCard?.dataValues?.card_id
      if (!userHasBilling && (!card_token || !exp_month || !exp_year || !cardholder_name))
        throw new CodedError("email is linked to another billing account", "PUR05")
      if (api_token !== user?.api_token) throw new CodedError("invalid credentials for email", "PUR06")

      // update card if card_token is provided
      if (card_token) {
        try {
          const newCardData = await createCard(user_id, card_token, exp_month, exp_year, cardholder_name, email, {
            allowNullUserId: false,
            sendEmailOnUpdate: true,
            attemptRenewal: false,
          })
          userCard = newCardData?.userCard
        } catch (error) {
          throw new CodedError(JSON.stringify(error), "PUR08")
        }
      }

      // check if user is already subscribed to product
      const userSubscriptions = await Subscription.findAll({ where: { user_id: user?.user_id } })
      userIsSubscribed = Array.isArray(userSubscriptions) //
        ? userSubscriptions.some((subscription) => subscription?.dataValues?.status !== "disabled")
        : false
    } else {
      if (!card_token) throw new CodedError("card_token is required", "PUR09") // required if creating new user
      if (!phone) throw new CodedError("phone is required", "PUR10") // required if creating new user

      let newCardData
      try {
        newCardData = await createCard(null, card_token, exp_month, exp_year, cardholder_name, email, {
          allowNullUserId: true,
          sendEmailOnUpdate: false, // they're gonna get a bunch of emails when they sign up anyway
          attemptRenewal: false,
        })
      } catch (error) {
        throw new CodedError(JSON.stringify(error), "PUR08")
      }
      userCard = newCardData?.userCard

      // create new user in system
      let whitelabelID = null
      if (whitelabel) {
        switch (whitelabel) {
          case "yhs":
            whitelabelID = 3
            break
        }
      }

      const formData = convertToFormata({
        email,
        phone,
        active: 0,
        name: cardholder_name,
        whitelabel_id: whitelabelID,
        slug,
      })
      const newUserRequest = await fetch(process.env.API_URL + "/users", {
        method: "POST",
        headers: {
          "x-api-token": process.env.API_MASTER_TOKEN,
          ...formData.getHeaders(),
        },
        body: formData,
      })

      newUser = await newUserRequest.json()

      if (newUser?.success !== "success" && newUser?.success !== "warning")
        throw new CodedError(JSON.stringify(newUser), "PUR11")
      user = { ...newUser?.data }

      // add new card to user
      await userCard.update({ user_id: newUser?.data?.user_id })
      user_id = newUser?.data?.user_id
    }

    // if user already had subscription, handle prorated charge for new subscription
    if (userIsSubscribed) {
      const proratedData = await checkProrated({ body: { user_id, product_id } })
      if (!proratedData) throw new CodedError("error getting prorated charge", "PUR14")

      if (proratedData?.proratedAmount > 0) {
        const proratedPayment = await createPayment({
          body: {
            user_id,
            amount: proratedData?.proratedAmount,
            memo: "Prorated charge for " + product?.dataValues?.product_name,
          },
          user: { email },
        })
        if (proratedPayment?.success !== "success") throw new CodedError(JSON.stringify(proratedPayment), "PUR15")
      }
    }

    const waiveSignupFee = coupon === "CPStart"

    // we create the product first, because if it fails, we don't want to charge the user
    const purchase = await handlePurchase(product_id, user, userIsSubscribed, userWithEmailExists, waiveSignupFee) // handle subscription change in here
    if (purchase.success !== "success") {
      throw new CodedError(JSON.stringify(purchase), "PUR13", {
        actions: ["emailAdmin", "removeNewUser"],
        remove: !userWithEmailExists,
        user_id: newUser?.data?.user_id,
      })
    }

    // if price is greater than 0, create new payment charge

    // removed this because we're handling the signup fee in the first subscription charge

    // if (product?.dataValues?.price > 0) {
    //   const payment = await createPayment({
    //     body: {
    //       user_id,
    //       amount: product?.dataValues?.price,
    //       memo: "Purchase of " + product?.dataValues?.product_name,
    //     },
    //     user: { email },
    //   })
    //   if (payment?.success !== "success") {
    //     throw new CodedError(JSON.stringify(payment), "PUR12", {
    //       actions: "removeNewUser",
    //       remove: !userWithEmailExists,
    //       user_id: newUser?.data?.user_id,
    //     })
    //   }
    // }

    res.json({ success: "success", data: { product, user, userCard } })
  } catch (error) {
    return handleErrors(req, res, error)
  }
})

const purchaseRoutes = router
export default purchaseRoutes
