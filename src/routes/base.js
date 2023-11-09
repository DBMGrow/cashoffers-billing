import express from "express"

const router = express.Router()

router.get("/", async (req, res) => {
  res.json({ status: true, message: "Welcome to the square payments microservice" })
})

const baseRoutes = router
export default baseRoutes
