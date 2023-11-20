import authMiddleware from "../middleware/authMiddleware"
import express from "express"
import fetch from "node-fetch"
import CodedError from "../config/CodedError"
import convertToFormata from "../utils/convertToFormdata"
import handleErrors from "../utils/handleErrors"
import createCard from "../utils/createCard"
import createPayment from "../utils/createPayment"
import handlePurchase from "../utils/handlePurchase"
import { Product } from "../database/Product"
import { UserCard } from "../database/UserCard"
import { Subscription } from "../database/Subscription"

const router = express.Router()

router.post("/", authMiddleware("payments_create", { allowSelf: true }), async (req, res) => {
  const { product_id, email, phone, card_token, exp_month, exp_year, cardholder_name, api_token } = req.body

  console.log("ENTERING")

  try {
    if (!product_id) throw new CodedError("product_id is required", "PUR01")
    if (!email) throw new CodedError("email is required", "PUR02")

    console.log("DB_FETCH_PRODUCT")

    const product = await Product.findOne({ where: { product_id } })
    if (!product) throw new CodedError("product not found", "PUR03")

    console.log("API_FETCH_USER")

    const url = process.env.API_URL + "/users?email=" + encodeURIComponent(email)
    const userWithEmail = await fetch(url, { headers: { "x-api-token": process.env.API_MASTER_TOKEN } })
    const userWithEmailData = await userWithEmail.json()
    const userWithEmailExists = userWithEmailData?.data?.length > 0

    console.log("USER_WITH_EMAIL_EXISTS", userWithEmailExists)

    let user = { ...userWithEmailData?.data?.[0] }
    let user_id = user?.user_id
    let userCard
    let newUser

    if (userWithEmailExists) {
      console.log("EXISTING_USER_ROUTE")

      if (!api_token) throw new CodedError("api_token is required", "PUR04")
      userCard = await UserCard.findOne({ where: { user_id: user?.user_id } })
      const userHasBilling = userCard?.dataValues?.card_id
      if (!userHasBilling) throw new CodedError("email is linked to another billing account", "PUR05")
      if (api_token !== user?.api_token) throw new CodedError("invalid credentials for email", "PUR06")

      // check if user is already subscribed to product
      const userSubscriptions = await Subscription.findAll({ where: { user_id: user?.user_id } })
      const userIsSubscribed = Array.isArray(userSubscriptions) //
        ? userSubscriptions.some((subscription) => subscription?.dataValues?.status !== "disabled")
        : false

      // TODO: #1 implement logic for handling changing subscription plans
      //       — will require taking data from existing plan and transferring it to the new one
      if (userIsSubscribed) throw new CodedError("user is already subscribed to product", "PUR07")
    } else {
      console.log("NEW_USER_ROUTE")

      if (!card_token) throw new CodedError("card_token is required", "PUR09") // required if creating new user
      if (!phone) throw new CodedError("phone is required", "PUR10") // required if creating new user

      // create new card
      console.log("CREATING_NEW_CARD")

      let newCardData
      try {
        newCardData = await createCard(null, card_token, exp_month, exp_year, cardholder_name, email, {
          allowNullUserId: true,
          sendEmailOnUpdate: false, // they're gonna get a bunch of emails when they sign up anyway
        })
      } catch (error) {
        throw new CodedError(JSON.stringify(error), "PUR08")
      }
      userCard = newCardData?.userCard

      console.log("CREATING_NEW_USER")

      // create new user in system
      const newUserRequest = await fetch(process.env.API_URL + "/users", {
        method: "POST",
        headers: {
          "x-api-token": process.env.API_MASTER_TOKEN,
        },
        body: convertToFormata({ email, phone, active: 0, name: cardholder_name }),
      })

      newUser = await newUserRequest.json()
      console.log("METHOD", newUser.method)
      if (newUser?.success !== "success") throw new CodedError(JSON.stringify(newUser), "PUR11")
      user = { ...newUser?.data }

      console.log("UPDATING_NEW_CARD")

      // add new card to user
      await userCard.update({ user_id: newUser?.data?.user_id })
      user_id = newUser?.data?.user_id
    }

    console.log("HANDLING_PURCHASE")

    // we create the product first, because if it fails, we don't want to charge the user
    const purchase = await handlePurchase(product_id, user)
    if (purchase.success !== "success") {
      throw new CodedError(JSON.stringify(purchase), "PUR13", {
        actions: ["emailAdmin", "removeNewUser"],
        remove: !userWithEmailExists,
        user_id: newUser?.data?.user_id,
      })
    }

    console.log("CREATING_PAYMENT")

    // if price is greater than 0, create new payment charge
    if (product?.dataValues?.price > 0) {
      const payment = await createPayment({
        body: {
          user_id,
          amount: product?.dataValues?.price,
          memo: "Purchase of " + product?.dataValues?.product_name,
        },
        user: { email },
      })
      if (payment?.success !== "success") {
        throw new CodedError(JSON.stringify(payment), "PUR12", {
          actions: "removeNewUser",
          remove: !userWithEmailExists,
          user_id: newUser?.data?.user_id,
        })
      }
    }

    console.log("PURCHASE_SUCCESSFUL")

    res.json({ success: "success", data: { product, user, userCard } })
  } catch (error) {
    return handleErrors(req, res, error)
  }
})

const purchaseRoutes = router
export default purchaseRoutes
