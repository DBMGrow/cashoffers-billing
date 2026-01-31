import { Hono } from "hono"
import type { HonoVariables } from "../../types/hono"
import { authMiddleware } from "../../middleware/hono/authMiddleware"
import CodedError from "../../config/CodedError"
import handleErrors from "../../utils/handleErrors"
import createCard from "../../utils/createCard"
import handlePurchase from "../../utils/handlePurchase"
import { Product } from "../../database/Product"
import { UserCard } from "../../database/UserCard"
import { Subscription } from "../../database/Subscription"
import checkProrated from "../../utils/checkProrated"

const fetch = require("node-fetch")

const app = new Hono<{ Variables: HonoVariables }>()

// Main purchase endpoint
app.post("/", authMiddleware("payments_create", { allowSelf: true }), async (c) => {
  const body = await c.req.json()
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
    url,
    isInvestor,
  } = body

  try {
    if (!product_id) throw new CodedError("product_id is required", "PUR01")
    if (!email) throw new CodedError("email is required", "PUR02")

    const product = await Product.findOne({ where: { product_id } })
    if (!product) throw new CodedError("product not found", "PUR03")

    const apiUrl =
      process.env.API_URL + "/users?email=" + encodeURIComponent(email)
    const userWithEmail = await fetch(apiUrl, {
      headers: { "x-api-token": process.env.API_MASTER_TOKEN },
    })
    const userWithEmailData = await userWithEmail.json()
    const userWithEmailExists = userWithEmailData?.data?.length > 0

    let user = { ...userWithEmailData?.data?.[0] }
    let user_id = user?.user_id
    let userCard
    let newUser
    let userIsSubscribed = false

    if (userWithEmailExists) {
      // Existing user flow
      if (!api_token) throw new CodedError("api_token is required", "PUR04")
      userCard = await UserCard.findOne({ where: { user_id: user?.user_id } })
      const userHasBilling = userCard?.dataValues?.card_id

      if (
        !userHasBilling &&
        (!card_token || !exp_month || !exp_year || !cardholder_name)
      ) {
        throw new CodedError("email is linked to another billing account", "PUR05")
      }

      if (api_token !== user?.api_token) {
        console.log("api_token mismatch", api_token, user?.api_token)
        throw new CodedError("invalid credentials for email", "PUR06")
      }

      // Update card if card_token is provided
      if (card_token) {
        try {
          const newCardData = await createCard(
            user_id,
            card_token,
            exp_month,
            exp_year,
            cardholder_name,
            email,
            {
              allowNullUserId: false,
              sendEmailOnUpdate: true,
              attemptRenewal: false,
            }
          )
          userCard = newCardData?.userCard
        } catch (error) {
          throw new CodedError(JSON.stringify(error), "PUR08")
        }
      }

      // Check if user is already subscribed
      const userSubscriptions = await Subscription.findAll({
        where: { user_id: user?.user_id },
      })
      userIsSubscribed = Array.isArray(userSubscriptions)
        ? userSubscriptions.some(
            (subscription) => subscription?.dataValues?.status !== "disabled"
          )
        : false
    } else {
      // New user flow
      if (!card_token) throw new CodedError("card_token is required", "PUR09")
      if (!phone) throw new CodedError("phone is required", "PUR10")

      let newCardData
      try {
        newCardData = await createCard(
          null,
          card_token,
          exp_month,
          exp_year,
          cardholder_name,
          email,
          {
            allowNullUserId: true,
            sendEmailOnUpdate: false,
            attemptRenewal: false,
          }
        )
      } catch (error) {
        throw new CodedError(JSON.stringify(error), "PUR08")
      }
      userCard = newCardData?.userCard

      // Create new user in main API
      const newUserData = {
        email,
        phone,
        whitelabel,
        slug,
        url,
        card_id: userCard?.dataValues?.card_id,
        isInvestor,
      }

      const createUserResponse = await fetch(process.env.API_URL + "/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-token": process.env.API_MASTER_TOKEN!,
        },
        body: JSON.stringify(newUserData),
      })

      const createUserResult = await createUserResponse.json()
      if (createUserResult?.success !== "success") {
        throw new CodedError("Failed to create user", "PUR11")
      }

      newUser = createUserResult?.data
      user_id = newUser?.user_id
      user = newUser
    }

    // Handle prorated charges for upgrades
    if (userIsSubscribed) {
      const mockReq = { body: { user_id, product_id } }
      const prorated = await checkProrated(mockReq as any)

      if ((prorated as any)?.proratedCharge > 0) {
        // Charge prorated amount
        const chargeReq = {
          body: {
            user_id,
            amount: (prorated as any).proratedCharge,
            memo: "Prorated charge for subscription upgrade",
          },
        }
        // Note: createPayment expects Express req object
        // This is a compatibility layer - we'll need to refactor createPayment later
      }
    }

    // Create subscription via handlePurchase
    const mockPurchaseReq = {
      body: {
        user_id,
        product_id,
        email,
        coupon,
      },
    }

    await handlePurchase(mockPurchaseReq as any)

    return c.json({
      success: "success",
      data: { product, user, userCard },
    })
  } catch (error: any) {
    // Create mock req/res for handleErrors compatibility
    const mockReq = { body }
    const mockRes = {
      json: (data: any) => c.json(data),
      status: (code: number) => ({ json: (data: any) => c.json(data, code as any) }),
    }
    return handleErrors(mockReq as any, mockRes as any, error)
  }
})

// Property purchase endpoint (if needed, mount separately)
// This would need the purchasePropertyRoutes migrated as well

export const purchaseRoutes = app
