import getUser from "../utils/getUser"

export default function authMiddleware(permissions) {
  if (!Array.isArray(permissions)) permissions = [permissions]

  return async function (req, res, next) {
    console.log("running")

    let user_id = null
    switch (req.method) {
      case "GET":
        user_id = req?.params?.user_id
        break
      case "POST":
        user_id = req?.body?.user_id
        break
    }

    const user = await getUser(req, user_id)
    if (user.success !== "success") return res.json({ success: "error", data: user })

    let authCheck =
      user?.success === "success" && //
      user?.data?.user_id === user_id

    let permissionsCheck = true

    if (permissions) permissionsCheck = permissions.includes(user?.data?.role)

    if (!authCheck) return res.json({ success: "error", error: "0000E: Unauthorized" })
    if (!permissionsCheck) return res.json({ success: "error", error: "0000F: Unauthorized" })

    next()
  }
}
