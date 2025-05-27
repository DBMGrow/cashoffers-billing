import authMiddleware from "../../middleware/authMiddleware"
import Router from "@/lib/router"
import { UserCard } from "../../database/UserCard"
import createCard from "../../utils/createCard"
import handleErrors from "../../utils/handleErrors"
import CodedError from "@/lib/CodedError"

const cardRouter = new Router()

cardRouter.get("/:[user_id]", {}, async (req, res) => {
  await req.getSession()
  const userCanReadAllCards = await req.userCan("payments_read_all")
  if (!userCanReadAllCards) throw new CodedError("Unauthorized", 401)

  const { user_id } = req.params

  if (!user_id) throw new Error("user_id is required")

  const userCard = await UserCard.findOne({ where: { user_id } })
  if (!userCard) throw new Error("No card found")

  res.success({ data: userCard })
})

cardRouter.get("/:user_id/info", {}, async (req, res) => {
  const { user_id } = req.params
  if (!user_id) throw new CodedError("0001C: user_id is required", 400)
  const userCard = await UserCard.findOne({ where: { user_id } })

  if (!userCard) {
    res.json({ success: "success", data: { has_card: false } })
    return
  }

  res.success({ success: "success", data: { has_card: true, ...userCard } })
})

cardRouter.post("/", {}, async (req, res) => {
  const session = await req.getSession()
  const userIsAdmin = await req.userCan("payments_read_all")

  let { user_id, card_token, exp_month, exp_year, cardholder_name } = req.body
  if (user_id !== session.user_id && !userIsAdmin) throw new CodedError("Unauthorized", 401)

  try {
    const response = await createCard(user_id, card_token, exp_month, exp_year, cardholder_name, req?.user?.email, {
      allowNullUserId: false,
    })

    res.json({ success: "success", data: response?.data })
  } catch (error) {
    return handleErrors(req, res, error)
  }
})

const cardRoutes = router
export default cardRoutes
