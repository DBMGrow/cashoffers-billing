import express from "express"
import sendEmail from "../utils/sendEmail"

const router = express.Router()

router.get("/", async (req, res) => {})

router.post("/", async (req, res) => {
  sendEmail()
  res.json({ success: "success" })
})

const emailRoutes = router
export default emailRoutes
