import express from "express"

const router = express.Router()

router.get("/", async (req, res) => {
  console.log("RECEIVED A GET")
  res.json({ success: "success" })
})

router.post("/", async (req, res) => {
  console.log("RECEIVED A POST")
  res.json({ success: "success" })
})

const logRoutes = router
export default logRoutes
